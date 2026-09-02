import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions } from '@src/overmind';
import {
  arrayBufferToBase64,
  buildCertificateSvg,
  buildPortraitFragment,
  CERTIFICATE_HEIGHT,
  CERTIFICATE_PNG_OVERSAMPLE,
  CERTIFICATE_WIDTH,
  svgToPngBytes,
} from './certificate';
import {
  CLASS_NAMES,
  RANK_MEDALS,
  RANK_NAMES,
  RARE_ACHIEVEMENTS,
  REGIMENTS,
  RIBBONS_PER_OVERALL_RANK,
  SPECIAL_ACHIEVEMENTS,
  TOTAL_ACHIEVEMENTS,
} from './definitions';
import {
  aggregateGlobalMetrics,
  countUnlocked,
  currentRankIndex,
  metricValue,
  topRankedMetrics,
} from './evaluate';
import {
  deliverWaitingUnlockNotifications,
  recordLeaderboardPublication,
  refreshGithubContributions,
} from './engine';
import { MedalIcon, METRIC_RIBBONS, SPECIAL_RIBBON, type MedalMetric } from './MedalIcon';
import { PortraitSetupDialog } from './PortraitSetupDialog';
import {
  BODY_TYPES,
  createDefaultDiceBearAvatar,
  decodeAvatarCode,
  diceBearAvatarUrl,
  EARRINGS_VARIANTS,
  encodeAvatarCode,
  EYE_VARIANTS,
  EYEBROW_VARIANTS,
  FEATURES_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_VARIANTS,
  HAIR_COLORS,
  MOUTH_VARIANTS,
  SKIN_COLORS,
} from './dicebear';
import type { DiceBearAvatarOptions } from './dicebear';
import {
  buildBodyUrl,
  pickBackgroundKey,
  pickPose,
  pickWeapon,
  UniformAvatar,
  weaponRankBoundsForBackground,
} from './UniformAvatar';
import { loadAchievementsState, saveAchievementsState } from './store';
import type { AchievementsState, UnlockedAchievement } from './types';
import { avatarSelectMenuProps } from './avatarSelectMenuProps';

interface AchievementsDialogProps {
  onClose: () => void;
  open: boolean;
}

// Verifies the player's GitHub identity, rate-limits, and publishes
// scores.json to lejeanbaptiste/scoreboard - see that repo's worker/
// directory. Superseded the Phase 1 copy-paste-into-a-GitHub-issue flow.
const LEADERBOARD_WORKER_URL = 'https://ljb-leaderboard.lejeanbaptiste.workers.dev';
// A hover-preview thumbnail on the leaderboard page, not the certificate's
// full size - keeps the upload quick and comfortably under the Worker's
// avatar size cap.
const LEADERBOARD_AVATAR_SIZE = 140;

const METRIC_LABELS: Record<string, string> = {
  texts: 'File saves',
  tags: 'Tags added',
  disambiguated: 'Tags disambiguated',
  places: 'Places disambiguated',
  entities: 'Entities on file',
  published: 'Days published to leaderboard',
  wetWork: 'Source-mode saves',
  flagOfCommitment: 'Repo contributions',
};

// Placeholder ribbon art (real art TBD) - reuses the same striped-gradient
// technique and per-metric colorways as RibbonRack in UniformAvatar.tsx. A
// single fixed-size ribbon regardless of class reached - a real service
// ribbon doesn't get bigger or multiply with seniority. A future pass will
// add a class device (star/rosette) on top of this same fixed ribbon rather
// than stacking more ribbons.
const RIBBON_HEIGHT = 12;
const RIBBON_WIDTH = RIBBON_HEIGHT * (18 / 7);

const ServiceRibbon = ({ metric }: { metric: MedalMetric }) => {
  const stripes = METRIC_RIBBONS[metric] ?? SPECIAL_RIBBON;
  const [c1, c2, c3] = stripes.length === 3 ? stripes : [stripes[0], stripes[1], stripes[0]];
  return (
    <Box
      sx={{
        background: `linear-gradient(90deg, ${c1} 0 33%, ${c2} 33% 66%, ${c3} 66%)`,
        border: '1px solid rgba(0,0,0,0.2)',
        flexShrink: 0,
        height: RIBBON_HEIGHT,
        width: RIBBON_WIDTH,
      }}
    />
  );
};

const collectDecorations = (state: AchievementsState): UnlockedAchievement[] => {
  const decorations: UnlockedAchievement[] = [];
  for (const def of [...SPECIAL_ACHIEVEMENTS, ...RARE_ACHIEVEMENTS]) {
    const entry = state.unlocked[def.id];
    if (entry) {
      decorations.push({ id: def.id, name: def.name, description: def.description, at: entry.at });
    }
  }
  return decorations.sort((a, b) => b.at.localeCompare(a.at));
};

/** Total ribbons (classes) earned across every metric ladder. */
const totalRibbonsEarned = (state: AchievementsState): number =>
  RANK_MEDALS.reduce(
    (total, medal) => total + Math.max(0, currentRankIndex(state, medal.metric) + 1),
    0,
  );

/** Composite rank index (0-based into RANK_NAMES) - every player starts at
 * index 0 (Fusilier) with zero ribbons; there is no separate Civil/rank-0
 * state and no opening-scene gate to cross first. Climbs one step per
 * RIBBONS_PER_OVERALL_RANK ribbons earned in any combination across the 8
 * metrics, independent of the per-metric classes shown in the grid below.
 * This is also what drives which visual assets (m-rank/f-rank body art,
 * backdrops, poses, weapons) are shown, so the portrait always matches the
 * "Sergent"-style label below it - it must NOT be computed from the single
 * best-performing metric ladder, which can run well ahead of the composite
 * rank and used to make the portrait look several grades more senior than
 * the player's actual commission. */
const calculatedRankIndex = (state: AchievementsState): number =>
  Math.min(RANK_NAMES.length - 1, Math.floor(totalRibbonsEarned(state) / RIBBONS_PER_OVERALL_RANK));

/** Ribbons earned since entering the player's current rank - resets to 0
 * every time calculatedRankIndex ticks up. Only consumed today by
 * pickBackgroundKey's Rank 4 group rollout (see UniformAvatar.tsx). */
const ribbonsIntoRank = (state: AchievementsState): number =>
  totalRibbonsEarned(state) % RIBBONS_PER_OVERALL_RANK;

/** Composite rank shown after the player's name - see calculatedRankIndex. */
const calculatedRank = (state: AchievementsState): string =>
  RANK_NAMES[calculatedRankIndex(state)]!;

export const AchievementsDialog = ({ onClose, open }: AchievementsDialogProps) => {
  const { notifyViaSnackbar } = useActions().ui;
  const { i18n } = useTranslation();
  const locale: 'fr' | 'en' = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const [state, setState] = useState<AchievementsState | null>(null);
  const [encoderName, setEncoderName] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  // True while the Code field has focus, so the sync effect below doesn't
  // overwrite what the player is actively typing/pasting with the
  // still-committed code on every re-render.
  const [codeFocused, setCodeFocused] = useState(false);
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState<number | null>(null);
  const [weaponRank, setWeaponRank] = useState<number | null>(null);
  const [weaponImageIds, setWeaponImageIds] = useState<string[]>([]);
  const [portraitEditorOpen, setPortraitEditorOpen] = useState(false);
  // True from the moment character creation is confirmed until the very
  // first live portrait render has actually finished loading its head/body
  // layers (see UniformAvatar's onReady) - covers exactly the one reveal
  // that can't benefit from the keepMounted prefetch trick below, since
  // there is no previous mount to have already fetched anything.
  const [revealingFirstPortrait, setRevealingFirstPortrait] = useState(false);
  const [portraitSetupOptions, setPortraitSetupOptions] = useState<DiceBearAvatarOptions | null>(
    null,
  );
  // Set while the pointer hovers an option in one of the head-part Selects
  // below, so the officer-header portrait shows that option live instead of
  // the committed one - lets someone judge a mouth or a hairstyle against
  // their own actual portrait before picking it, with no extra UI real
  // estate and no scaling logic (it's a real composite, same as the
  // committed avatar).
  const [hoverPreview, setHoverPreview] = useState<Partial<DiceBearAvatarOptions> | null>(null);
  const showAlignmentGrid =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('portraitGrid') === '1';

  // Rank that poseIndex/weaponRank/weaponImageIds were last rolled for - lets
  // the GitHub-refresh branch below tell a real rank-up apart from a
  // same-rank state update, instead of just trusting whichever `setState`
  // call happens to land last (see pickPortraitFor).
  const pickedForRankRef = useRef<number | null>(null);

  // The pose/backdrop/weapon-tier last rolled, mirroring the same three
  // pieces of state. The picks feed into each other (the backdrop depends on
  // the pose, and the backdrop's rank constrains the weapon pool), and a
  // `setState` updater doesn't run until React re-renders - so reading the
  // previous value through an updater, as this used to, meant the backdrop
  // key was still unset when the weapon pick needed its rank, and every
  // portrait rolled its weapon unrestricted. Refs are readable right now.
  const lastPoseRef = useRef<number | null>(null);
  const lastBackgroundKeyRef = useRef<string | null>(null);
  const lastWeaponRankRef = useRef<number | null>(null);

  // Pose, backdrop, and weapon are all randomized together (Daniel: "pose and
  // weapons will be random"), picked together with `state` (React batches
  // this) so everything's already resolved by the time the render below
  // needs it. Pose is picked first: the backdrop and weapon both depend on
  // which pose just got rolled (some poses pair with pose-specific scene
  // rules - subject scenes carry their own embedded backgrounds - and weapon
  // art is pose-specific), not the stale pose still in state.
  const pickPortraitFor = (loaded: AchievementsState) => {
    setState(loaded);
    const loadedBodyType =
      loaded.avatar?.kind === 'dicebear'
        ? loaded.avatar.options.bodyType
        : createDefaultDiceBearAvatar(encoderName).bodyType;
    const rankIndex = calculatedRankIndex(loaded);
    const newPose = pickPose(lastPoseRef.current, loadedBodyType, rankIndex);
    const newBackgroundKey = pickBackgroundKey(
      rankIndex,
      lastBackgroundKeyRef.current,
      newPose,
      ribbonsIntoRank(loaded),
    );
    // Keep the weapon pool locked to the same era as the backdrop that was
    // just rolled (exact tier for ranks 1–4; modern-era floor for 5+).
    const weaponBounds = weaponRankBoundsForBackground(newBackgroundKey);
    const weapon = pickWeapon(
      newPose,
      loadedBodyType,
      rankIndex,
      lastWeaponRankRef.current,
      weaponBounds.floor,
      weaponBounds.ceiling,
    );
    lastPoseRef.current = newPose;
    lastBackgroundKeyRef.current = newBackgroundKey;
    lastWeaponRankRef.current = weapon?.rank ?? null;
    setPoseIndex(newPose);
    setBackgroundKey(newBackgroundKey);
    setWeaponRank(weapon?.rank ?? null);
    setWeaponImageIds(weapon?.imageIds ?? []);
    pickedForRankRef.current = rankIndex;
  };

  // Loads achievements state and re-rolls the backdrop/pose/weapon pick.
  // Called on mount (so everything's already resolved and fetched well
  // before the user ever opens the dialog - see the effect below) and again
  // every time the dialog closes (so the *next* open is instant too,
  // instead of re-rolling and re-fetching at the moment the user clicks -
  // that round trip through loadAchievementsState/pickPose/pickWeapon and
  // then UniformAvatar's own head/body SVG fetches was exactly what caused
  // the panel to visibly build itself piece by piece on every single open).
  const refreshPortrait = () => {
    void loadAchievementsState().then(pickPortraitFor);
    // Best-effort, no-ops when the cached count isn't stale or there's no
    // linked GitHub token yet - refreshes quietly in the background rather
    // than blocking the rest of refreshPortrait's synchronous-feeling flow.
    // If it resolves with a HIGHER rank than the local-state branch above
    // already picked pose/weapon for (a real-time rank-up crossing the
    // network round trip), that pick is now for the wrong rank - e.g. a
    // rank-1-only weapon spliced into a rank-5 composite - so re-roll for
    // the rank the player actually ended up at instead of just trusting
    // whichever `setState` lands last.
    void refreshGithubContributions(() => {}).then((refreshed) => {
      if (calculatedRankIndex(refreshed) !== pickedForRankRef.current) {
        pickPortraitFor(refreshed);
      } else {
        setState(refreshed);
      }
    });
  };

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      refreshPortrait();
      return;
    }
    // Wait out the dialog's own close transition (keepMounted means the DOM
    // - and this effect - fire the instant `open` flips false, mid-fade)
    // before re-rolling the portrait; otherwise the player sees the next
    // pose/backdrop/weapon build itself layer by layer while the dialog is
    // still visibly closing.
    if (!open) {
      const timer = setTimeout(refreshPortrait, 1000);
      return () => clearTimeout(timer);
    }
    // Keyed to `open` alone: `refreshPortrait` is redefined every render, so
    // depending on it would reschedule the re-roll timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the Service Record name in sync with the splash name prompt.
  // TitleBar mounts this dialog early (empty name); without this listener the
  // header stays "Unknown Encoder" until a full remount.
  useEffect(() => {
    const syncEncoderName = () => {
      const fromBridge = window.__ljbCommonsUi?.encoderName;
      if (typeof fromBridge === 'string') {
        setEncoderName(fromBridge);
        return;
      }
      void window.electronAPI
        ?.getEncoderName()
        .then(setEncoderName)
        .catch(() => setEncoderName(''));
    };
    syncEncoderName();
    window.addEventListener('ljbCommonsUiChanged', syncEncoderName);
    return () => window.removeEventListener('ljbCommonsUiChanged', syncEncoderName);
  }, []);

  useEffect(() => {
    if (!state || codeFocused) return;
    const options =
      state.avatar?.kind === 'dicebear'
        ? state.avatar.options
        : createDefaultDiceBearAvatar(encoderName);
    setCodeDraft(encodeAvatarCode(options));
  }, [codeFocused, encoderName, state]);

  // Regiment = whichever metric ladder the player's single highest class is
  // in; a tie is broken by picking at random among the tied metrics. The
  // pick re-rolls (via useMemo's key) whenever the tied set itself changes -
  // e.g. a new rank-up - so it "alternates" across ties rather than sticking
  // to one arbitrarily forever. Hook order must stay unconditional, so this
  // runs before the early return below even though `state` may be null yet.
  const tiedMetrics = state ? topRankedMetrics(state) : [];
  const tiedMetricsKey = tiedMetrics.join(',');
  const assignedRegimentMetric = useMemo(() => {
    if (tiedMetrics.length === 0) return null;
    return tiedMetrics[Math.floor(Math.random() * tiedMetrics.length)] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the tie set, not the array identity
  }, [tiedMetricsKey]);
  const assignedRegiment = REGIMENTS.find((r) => r.metric === assignedRegimentMetric) ?? null;

  if (!state || !backgroundKey || poseIndex === null) {
    return <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open} />;
  }

  const global = aggregateGlobalMetrics(state);
  const unlockedCount = countUnlocked(state);
  const percent = Math.round((unlockedCount / TOTAL_ACHIEVEMENTS) * 100);
  const decorations = collectDecorations(state);
  const commission = calculatedRank(state);
  const avatarOptions =
    state.avatar?.kind === 'dicebear'
      ? state.avatar.options
      : createDefaultDiceBearAvatar(encoderName);
  const setupAvatarOptions = portraitSetupOptions ?? avatarOptions;
  const avatarUrl = diceBearAvatarUrl(avatarOptions);
  // Committed avatar unless a Select option is currently hovered - see
  // hoverPreview above.
  const displayedAvatarUrl = hoverPreview
    ? diceBearAvatarUrl({ ...avatarOptions, ...hoverPreview })
    : avatarUrl;
  const serviceSince = new Date(state.installedAt).toLocaleDateString();
  const displayRankIndex = calculatedRankIndex(state);
  const weaponSelection =
    weaponRank !== null ? { imageIds: weaponImageIds, rank: weaponRank } : null;
  const bodyBackUrl = buildBodyUrl(
    poseIndex,
    avatarOptions.bodyType,
    displayRankIndex,
    weaponSelection,
    'back',
  );
  const bodyFrontUrl = buildBodyUrl(
    poseIndex,
    avatarOptions.bodyType,
    displayRankIndex,
    weaponSelection,
    'front',
  );
  const serviceRibbons = RANK_MEDALS.filter(
    (medal) => currentRankIndex(state, medal.metric) >= 0,
  ).map((medal) => METRIC_RIBBONS[medal.metric] ?? SPECIAL_RIBBON);
  // Only special/rare achievements ("decorations") are medals - rank-ladder
  // progress is shown as ribbons (serviceRibbons/RibbonRack), not as one
  // medal per class earned. See rank-and-medal-reference.md's "Ribbons vs
  // medals" section: ribbons are earned toward rank, medals are separate.
  const uniformMedals = decorations.map((decoration) => ({
    label: decoration.name,
    metric: 'special' as const,
    tier: 'gold' as const,
  }));

  const certificateMetrics = Object.entries(METRIC_LABELS).map(([metric, label]) => ({
    label,
    value: metricValue(global, metric),
  }));

  const printCertificate = async () => {
    try {
      const [headSvgMarkup, bodyBackSvgMarkup, bodyFrontSvgMarkup] = await Promise.all([
        fetch(avatarUrl).then((response) => response.text()),
        fetch(bodyBackUrl).then((response) => response.text()),
        fetch(bodyFrontUrl).then((response) => response.text()),
      ]);
      // Same medals/ribbons/pose/weapon the live avatar shows on the
      // uniform - the certificate's portrait is the exact same composite,
      // not a redrawn approximation, so there's no separate condensed
      // medal list here.
      const portraitFragment = await buildPortraitFragment({
        backgroundImageKey: backgroundKey,
        bodyBackSvgMarkup,
        bodyFrontSvgMarkup,
        bodyType: avatarOptions.bodyType,
        hairColor: avatarOptions.hairColor,
        hairVariant: avatarOptions.hairVariant,
        headSvgMarkup,
        medals: uniformMedals,
        poseIndex,
        serviceRibbons,
        skinColor: avatarOptions.skinColor,
      });
      const svg = buildCertificateSvg({
        commission,
        encoderName: encoderName.trim() || 'Unknown Encoder',
        metrics: certificateMetrics,
        portraitFragment,
        regiment: assignedRegiment
          ? { name: assignedRegiment.name, slogan: assignedRegiment.slogan }
          : null,
        serviceSince,
        totalAchievements: TOTAL_ACHIEVEMENTS,
        unlockedCount,
      });
      // Oversampled (see svgToPngBytes's doc comment) - this PNG is meant to
      // be printed or shared at full size, so denser rasterization avoids
      // the staircased edges a plain 1x canvas draw leaves on diagonal/
      // curved body art.
      const bytes = await svgToPngBytes(
        svg,
        CERTIFICATE_WIDTH,
        CERTIFICATE_HEIGHT,
        CERTIFICATE_PNG_OVERSAMPLE,
      );
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      const dateTimeSuffix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}h${pad(now.getMinutes())}`;
      const suggestedName = `${(encoderName.trim() || 'service-record')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}-service-record ${dateTimeSuffix}.png`;
      const saved = await window.electronAPI?.saveCertificatePng?.(bytes, suggestedName);
      if (saved) {
        notifyViaSnackbar({
          message: 'Certificate saved.',
          options: { variant: 'success', autoHideDuration: 4000 },
        });
      }
    } catch {
      notifyViaSnackbar({
        message: 'Could not generate the certificate.',
        options: { variant: 'error', autoHideDuration: 5000 },
      });
    }
  };

  const submitToLeaderboard = async () => {
    try {
      let token = await window.electronAPI?.getCachedLeaderboardToken?.();
      if (!token) {
        const flow = await window.electronAPI?.startLeaderboardDeviceFlow?.();
        if (!flow) throw new Error('Could not start GitHub login.');
        const copyCode = () =>
          void window.electronAPI?.writeClipboardRich?.({ text: flow.userCode });
        // Copied immediately so pasting on the GitHub page that just opened
        // is the only step - the button below is just a fallback in case
        // something else overwrote the clipboard in the meantime.
        copyCode();
        notifyViaSnackbar({
          message: `Code ${flow.userCode} copied — paste it on the GitHub page that just opened to link your account (one-time).`,
          options: {
            variant: 'info',
            autoHideDuration: 15000,
            action: () => (
              <Button color="inherit" onPointerDown={copyCode}>
                Copy code
              </Button>
            ),
          },
        });
        const result = await window.electronAPI?.pollLeaderboardDeviceFlow?.(
          flow.deviceCode,
          flow.interval,
          flow.expiresIn,
        );
        if (!result || 'error' in result) {
          throw new Error(result && 'error' in result ? result.error : 'GitHub login failed.');
        }
        token = result.token;
      }

      // Best-effort: a small hover-preview thumbnail, not the full
      // certificate size, so the upload stays quick and the Worker's
      // avatar size cap is comfortable to stay under. A failure here
      // shouldn't block the actual score submission.
      let avatarPngBase64: string | undefined;
      try {
        const [headSvgMarkup, bodyBackSvgMarkup, bodyFrontSvgMarkup] = await Promise.all([
          fetch(avatarUrl).then((response) => response.text()),
          fetch(bodyBackUrl).then((response) => response.text()),
          fetch(bodyFrontUrl).then((response) => response.text()),
        ]);
        const portraitFragment = await buildPortraitFragment(
          {
            backgroundImageKey: backgroundKey,
            bodyBackSvgMarkup,
            bodyFrontSvgMarkup,
            bodyType: avatarOptions.bodyType,
            hairColor: avatarOptions.hairColor,
            hairVariant: avatarOptions.hairVariant,
            headSvgMarkup,
            medals: uniformMedals,
            poseIndex,
            serviceRibbons,
            skinColor: avatarOptions.skinColor,
          },
          LEADERBOARD_AVATAR_SIZE,
        );
        const avatarBytes = await svgToPngBytes(
          portraitFragment.svg,
          portraitFragment.width,
          portraitFragment.height,
        );
        avatarPngBase64 = arrayBufferToBase64(avatarBytes.buffer as ArrayBuffer);
      } catch {
        avatarPngBase64 = undefined;
      }

      const response = await fetch(`${LEADERBOARD_WORKER_URL}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          commission,
          metrics: {
            texts: global.texts,
            tags: global.tags,
            disambiguated: global.disambiguated,
            places: global.places,
            entities: global.entities,
            published: global.published,
          },
          unlockedCount,
          totalAchievements: TOTAL_ACHIEVEMENTS,
          avatarPngBase64,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Submission failed.');

      const updated = await recordLeaderboardPublication(new Date(), (message) =>
        notifyViaSnackbar({
          message,
          options: { variant: 'success', autoHideDuration: 7000 },
        }),
      );
      setState({ ...updated });

      notifyViaSnackbar({
        message: body.message ?? 'Added to the leaderboard.',
        options: { variant: 'success', autoHideDuration: 5000 },
      });
    } catch (err) {
      notifyViaSnackbar({
        message: err instanceof Error ? err.message : 'Could not submit to the leaderboard.',
        options: { variant: 'error', autoHideDuration: 6000 },
      });
    }
  };

  const updateAvatar = async (changes: Partial<typeof avatarOptions>) => {
    const current = await loadAchievementsState();
    const firstCharacter = current.avatar === null;
    const options = { ...avatarOptions, ...changes };
    current.avatar = { kind: 'dicebear', options };
    await saveAchievementsState(current);
    setState({ ...current });
    // Medals earned before a portrait existed are already unlocked on disk;
    // only now may their toast notifications fire.
    if (firstCharacter) {
      deliverWaitingUnlockNotifications(current, (message) =>
        notifyViaSnackbar({
          message,
          options: { variant: 'success', autoHideDuration: 7000 },
        }),
      );
    }
  };

  const updatePortraitSetup = (changes: Partial<DiceBearAvatarOptions>) => {
    setPortraitSetupOptions((current) => ({ ...(current ?? setupAvatarOptions), ...changes }));
  };

  const finishPortraitSetup = async () => {
    const current = await loadAchievementsState();
    current.avatar = { kind: 'dicebear', options: setupAvatarOptions };
    await saveAchievementsState(current);
    setRevealingFirstPortrait(true);
    setState({ ...current });
    setPortraitEditorOpen(false);
    deliverWaitingUnlockNotifications(current, (message) =>
      notifyViaSnackbar({
        message,
        options: { variant: 'success', autoHideDuration: 7000 },
      }),
    );
  };

  // Keep the Service Record entirely out of the DOM until the portrait is
  // confirmed. A nested dialog would leave its title faintly visible under
  // the setup modal's backdrop and spoil the first-time reveal.
  if (state.avatar === null) {
    return (
      <PortraitSetupDialog
        onChange={updatePortraitSetup}
        onFinish={() => void finishPortraitSetup()}
        open={open}
        options={setupAvatarOptions}
      />
    );
  }

  // keepMounted below: without it, MUI tears down everything inside
  // (including UniformAvatar and its head/body SVG fetches) on every close,
  // so the next open has to redo that whole round trip from scratch instead
  // of reusing what refreshPortrait already prefetched while closed. The
  // same UniformAvatar instance below also drives revealingFirstPortrait
  // (see its declaration above): the content stays mounted (visibility, not
  // a conditional) so its very first load isn't wasted when the spinner
  // clears, just hidden under the overlay until onReady fires.
  return (
    <Dialog fullWidth keepMounted maxWidth="sm" onClose={onClose} open={open}>
      {!revealingFirstPortrait && <DialogTitle>LJB Service Record</DialogTitle>}
      <DialogContent
        sx={{ position: 'relative', ...(portraitEditorOpen ? { overflow: 'visible' } : undefined) }}
      >
        {revealingFirstPortrait && (
          <Box
            sx={{
              alignItems: 'center',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              inset: 0,
              justifyContent: 'center',
              position: 'absolute',
              zIndex: 1,
            }}
          >
            <CircularProgress />
            <Typography color="text.secondary">Preparing your Service Record…</Typography>
          </Box>
        )}
        <Stack spacing={3} sx={revealingFirstPortrait ? { visibility: 'hidden' } : undefined}>
          {/* Officer header */}
          <Stack alignItems="center" direction="row" spacing={2}>
            <Box
              onClick={() => setPortraitEditorOpen((openEditor) => !openEditor)}
              sx={{ cursor: 'pointer', flexShrink: 0, textAlign: 'center' }}
              title={portraitEditorOpen ? 'Close portrait editor' : 'Edit portrait'}
            >
              <UniformAvatar
                headImageUrl={displayedAvatarUrl}
                bodyBackImageUrl={bodyBackUrl}
                bodyFrontImageUrl={bodyFrontUrl}
                backgroundImageKey={backgroundKey}
                medals={uniformMedals}
                onReady={() => setRevealingFirstPortrait(false)}
                serviceRibbons={serviceRibbons}
                showAlignmentGrid={showAlignmentGrid}
                size={128}
              />
            </Box>
            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap variant="h6">
                {encoderName.trim() || 'Unknown Encoder'}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {commission}
                {assignedRegiment ? `, ${assignedRegiment.name}` : ''}
              </Typography>
              {assignedRegiment && (
                <Typography
                  color="text.secondary"
                  component="div"
                  sx={{ fontStyle: 'italic' }}
                  variant="body2"
                >
                  « {assignedRegiment.slogan} »
                </Typography>
              )}
              <Typography color="text.secondary" variant="caption">
                In service since {serviceSince}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                <Tooltip title="Print certificate">
                  <IconButton
                    aria-label="Print certificate"
                    onClick={() => void printCertificate()}
                    size="small"
                  >
                    <PrintIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Submit to leaderboard">
                  <IconButton
                    aria-label="Submit to leaderboard"
                    onClick={() => void submitToLeaderboard()}
                    size="small"
                  >
                    <EmojiEventsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Stack>
          {portraitEditorOpen && (
            <Box>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <FormControl size="small" sx={{ minWidth: 72 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Body type"
                    value={avatarOptions.bodyType}
                    onChange={(event) =>
                      void updateAvatar({ bodyType: event.target.value as 'm' | 'f' })
                    }
                  >
                    {BODY_TYPES.map((bodyType) => (
                      <MenuItem key={bodyType.value} value={bodyType.value}>
                        {bodyType.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Code"
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => {
                    setCodeFocused(false);
                    const decoded = decodeAvatarCode(codeDraft);
                    if (decoded) {
                      void updateAvatar(decoded);
                    } else {
                      setCodeDraft(encodeAvatarCode(avatarOptions));
                      if (codeDraft.trim() !== encodeAvatarCode(avatarOptions)) {
                        notifyViaSnackbar({
                          message: 'That code is not valid.',
                          options: { variant: 'error', autoHideDuration: 4000 },
                        });
                      }
                    }
                  }}
                  onChange={(event) => setCodeDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  size="small"
                  sx={{ minWidth: 240, flex: '1 1 240px' }}
                  value={codeDraft}
                />
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Eyebrows"
                    onClose={() => setHoverPreview(null)}
                    value={avatarOptions.eyebrowsVariant}
                    onChange={(event) => void updateAvatar({ eyebrowsVariant: event.target.value })}
                  >
                    {EYEBROW_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() => setHoverPreview({ eyebrowsVariant: variant })}
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >{`Eyebrows ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Eyes"
                    onClose={() => setHoverPreview(null)}
                    value={avatarOptions.eyesVariant}
                    onChange={(event) => void updateAvatar({ eyesVariant: event.target.value })}
                  >
                    {EYE_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() => setHoverPreview({ eyesVariant: variant })}
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >{`Eyes ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Mouth"
                    onClose={() => setHoverPreview(null)}
                    value={avatarOptions.mouthVariant}
                    onChange={(event) => void updateAvatar({ mouthVariant: event.target.value })}
                  >
                    {MOUTH_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() => setHoverPreview({ mouthVariant: variant })}
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >{`Mouth ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Features"
                    onClose={() => setHoverPreview(null)}
                    value={
                      avatarOptions.featuresProbability ? avatarOptions.featuresVariant : 'none'
                    }
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { featuresProbability: 0 }
                          : { featuresVariant: event.target.value, featuresProbability: 100 },
                      )
                    }
                  >
                    <MenuItem
                      onMouseEnter={() => setHoverPreview({ featuresProbability: 0 })}
                      onMouseLeave={() => setHoverPreview(null)}
                      value="none"
                    >
                      No feature
                    </MenuItem>
                    {FEATURES_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() =>
                          setHoverPreview({ featuresVariant: variant, featuresProbability: 100 })
                        }
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >
                        {variant.charAt(0).toUpperCase() + variant.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Glasses"
                    onClose={() => setHoverPreview(null)}
                    value={avatarOptions.glassesProbability ? avatarOptions.glassesVariant : 'none'}
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { glassesProbability: 0 }
                          : { glassesVariant: event.target.value, glassesProbability: 100 },
                      )
                    }
                  >
                    <MenuItem
                      onMouseEnter={() => setHoverPreview({ glassesProbability: 0 })}
                      onMouseLeave={() => setHoverPreview(null)}
                      value="none"
                    >
                      No glasses
                    </MenuItem>
                    {GLASSES_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() =>
                          setHoverPreview({ glassesVariant: variant, glassesProbability: 100 })
                        }
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >{`Glasses ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Hair"
                    onClose={() => setHoverPreview(null)}
                    value={avatarOptions.hairVariant}
                    onChange={(event) => void updateAvatar({ hairVariant: event.target.value })}
                  >
                    {HAIR_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() => setHoverPreview({ hairVariant: variant })}
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >
                        {variant.startsWith('long') ? 'Long hair' : 'Short hair'}{' '}
                        {variant.slice(-2)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Earrings"
                    onClose={() => setHoverPreview(null)}
                    value={
                      avatarOptions.earringsProbability ? avatarOptions.earringsVariant : 'none'
                    }
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { earringsProbability: 0 }
                          : { earringsVariant: event.target.value, earringsProbability: 100 },
                      )
                    }
                  >
                    <MenuItem
                      onMouseEnter={() => setHoverPreview({ earringsProbability: 0 })}
                      onMouseLeave={() => setHoverPreview(null)}
                      value="none"
                    >
                      No earrings
                    </MenuItem>
                    {EARRINGS_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        onMouseEnter={() =>
                          setHoverPreview({ earringsVariant: variant, earringsProbability: 100 })
                        }
                        onMouseLeave={() => setHoverPreview(null)}
                        value={variant}
                      >{`Earrings ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Skin tone"
                    value={avatarOptions.skinColor}
                    onChange={(event) => void updateAvatar({ skinColor: event.target.value })}
                  >
                    {SKIN_COLORS.map((color) => (
                      <MenuItem key={color.value} value={color.value}>
                        {color.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    MenuProps={avatarSelectMenuProps}
                    aria-label="Hair color"
                    value={avatarOptions.hairColor}
                    onChange={(event) => void updateAvatar({ hairColor: event.target.value })}
                  >
                    {HAIR_COLORS.map((color) => (
                      <MenuItem key={color.value} value={color.value}>
                        {color.label} hair
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>
          )}

          {/* Overall progress */}
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2">
                {unlockedCount} / {TOTAL_ACHIEVEMENTS} achievements
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {percent}%
              </Typography>
            </Stack>
            <LinearProgress
              sx={{ height: 8, borderRadius: 1 }}
              value={percent}
              variant="determinate"
            />
          </Box>

          {/* Rank medals */}
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {RANK_MEDALS.map((medal) => {
              const rankIndex = currentRankIndex(state, medal.metric);
              const value = metricValue(global, medal.metric);
              const nextThreshold =
                rankIndex + 1 < medal.thresholds.length ? medal.thresholds[rankIndex + 1]! : null;
              const prevThreshold = rankIndex >= 0 ? medal.thresholds[rankIndex]! : 0;
              const towardNext = nextThreshold
                ? Math.min(100, ((value - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
                : 100;
              return (
                <Paper key={medal.metric} sx={{ p: 1.5 }} variant="outlined">
                  <Stack alignItems="center" direction="row" spacing={1}>
                    <ServiceRibbon metric={medal.metric as MedalMetric} />
                    <Typography noWrap variant="subtitle2">
                      {medal.medalName[locale]}
                    </Typography>
                  </Stack>
                  <Box>
                    <Typography color="text.secondary" component="div" variant="caption">
                      {METRIC_LABELS[medal.metric]}: {value.toLocaleString()}
                    </Typography>
                    <Typography color="text.secondary" component="div" variant="caption">
                      {rankIndex >= 0
                        ? nextThreshold
                          ? `${CLASS_NAMES[rankIndex]} — ${value.toLocaleString()} / ${nextThreshold.toLocaleString()} until next classe`
                          : `${CLASS_NAMES[rankIndex]} — highest class attained`
                        : `${value.toLocaleString()} / ${medal.thresholds[0]!.toLocaleString()} until next classe`}
                    </Typography>
                    <LinearProgress
                      sx={{ height: 4, borderRadius: 1, mt: 0.5 }}
                      value={rankIndex >= 0 || value > 0 ? towardNext : 0}
                      variant="determinate"
                    />
                  </Box>
                </Paper>
              );
            })}
          </Box>

          {/* Decorations carousel */}
          <Box>
            <Typography sx={{ mb: 1 }} variant="subtitle2">
              Decorations
            </Typography>
            {decorations.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                None yet. Serve with distinction.
              </Typography>
            ) : (
              <Stack
                direction="row"
                spacing={2}
                sx={{ overflowX: 'auto', pb: 1, scrollSnapType: 'x proximity' }}
              >
                {decorations.map((decoration) => (
                  <Tooltip
                    key={decoration.id}
                    title={`${decoration.description} — ${new Date(decoration.at).toLocaleDateString()}`}
                  >
                    <Stack
                      alignItems="center"
                      spacing={0.5}
                      sx={{ minWidth: 88, scrollSnapAlign: 'start', textAlign: 'center' }}
                    >
                      <MedalIcon metric="special" size={44} tier="gold" />
                      <Typography sx={{ maxWidth: 96 }} variant="caption">
                        {decoration.name}
                      </Typography>
                    </Stack>
                  </Tooltip>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Dismissed</Button>
      </DialogActions>
    </Dialog>
  );
};
