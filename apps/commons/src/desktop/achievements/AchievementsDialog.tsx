import {
  Box,
  Button,
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
  STARTER_RANK_NAME,
  TOTAL_ACHIEVEMENTS,
} from './definitions';
import {
  aggregateGlobalMetrics,
  countUnlocked,
  currentRankIndex,
  metricValue,
  topRankedMetrics,
} from './evaluate';
import { recordLeaderboardPublication, refreshGithubContributions } from './engine';
import {
  MedalIcon,
  METRIC_RIBBONS,
  SPECIAL_RIBBON,
  type MedalMetric,
} from './MedalIcon';
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

// bodies/body0.svg - the plain civilian body, deliberately excluded from
// POSE_INDICES/the random pose pool (see generatedBodyPools.ts) since it has
// no per-rank uniform kit. Shown fixed, never randomized, for unranked
// ("Civil") players in place of a picked pose.
const CIVILIAN_POSE_INDEX = 0;

const METRIC_LABELS: Record<string, string> = {
  texts: 'Documents saved',
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

/** Highest rank index (0-based into RANK_NAMES) held across all metrics,
 * -1 when unranked. Drives which portrait backdrops are unlocked. */
const highestRankIndexOf = (state: AchievementsState): number =>
  Math.max(-1, ...RANK_MEDALS.map((medal) => currentRankIndex(state, medal.metric)));

/** Total ribbons (classes) earned across every metric ladder. */
const totalRibbonsEarned = (state: AchievementsState): number =>
  RANK_MEDALS.reduce(
    (total, medal) => total + Math.max(0, currentRankIndex(state, medal.metric) + 1),
    0,
  );

/** Composite rank index (0-based into RANK_NAMES), or -1 when unranked -
 * climbs one step per RIBBONS_PER_OVERALL_RANK ribbons earned in any
 * combination across the 8 metrics, independent of the per-metric classes
 * shown in the grid below. This is also what drives which visual assets
 * (m-rank/f-rank body art, backdrops, poses, weapons) are shown, so the
 * portrait always matches the "Sergent"-style label below it - it must NOT
 * be computed from highestRankIndexOf (the single best-performing metric
 * ladder), which can run well ahead of the composite rank and used to make
 * the portrait look several grades more senior than the player's actual
 * commission. */
const calculatedRankIndex = (state: AchievementsState): number => {
  if (highestRankIndexOf(state) === -1) return -1;
  return Math.min(
    RANK_NAMES.length - 1,
    Math.floor(totalRibbonsEarned(state) / RIBBONS_PER_OVERALL_RANK),
  );
};

/** Composite rank shown after the player's name - see calculatedRankIndex.
 * Civil is only the one-time pre-opening-scene state (no ribbon earned
 * anywhere yet) - the very first ribbon already makes the player Fusilier,
 * per the reference doc's "after the opening scene, the user starts as
 * rank 1 fusilier". It must NOT be folded into the same 6-ribbons-per-step
 * division as the 7 real ranks, or every step (Fusilier..Général de
 * brigade) shifts one 6-ribbon bucket late and the top rank needs 42
 * ribbons instead of the intended 36 (6 steps x 6 ribbons). */
const calculatedRank = (state: AchievementsState): string => {
  const rankIndex = calculatedRankIndex(state);
  return rankIndex === -1 ? STARTER_RANK_NAME : RANK_NAMES[rankIndex]!;
};

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

  // Loads achievements state and re-rolls the backdrop/pose/weapon pick.
  // Called on mount (so everything's already resolved and fetched well
  // before the user ever opens the dialog - see the effect below) and again
  // every time the dialog closes (so the *next* open is instant too,
  // instead of re-rolling and re-fetching at the moment the user clicks -
  // that round trip through loadAchievementsState/pickPose/pickWeapon and
  // then UniformAvatar's own head/body SVG fetches was exactly what caused
  // the panel to visibly build itself piece by piece on every single open).
  // Auto-expands the portrait editor the very first time this ever loads
  // for a player who's never touched avatar customization (state.avatar is
  // only null until they change something, and that persists from then on -
  // no separate "have they seen this" flag needed). Checked once, off the
  // first resolved state, not on every refreshPortrait() call - otherwise
  // it'd also spring back open on every later close/reopen for a player who
  // deliberately collapsed it without ever picking a single option.
  const autoOpenCheckedRef = useRef(false);
  const refreshPortrait = () => {
    void loadAchievementsState().then((loaded) => {
      setState(loaded);
      if (!autoOpenCheckedRef.current) {
        autoOpenCheckedRef.current = true;
        if (loaded.avatar === null) setPortraitEditorOpen(true);
      }
      // Picked together with `state` (React batches this) so the backdrop
      // is already resolved by the time the render below needs it.
      setBackgroundKey((previous) => pickBackgroundKey(calculatedRankIndex(loaded), previous));
      // Pose and weapon are randomized the same way as the backdrop above
      // (Daniel: "pose and weapons will be random"). Weapon depends on
      // which pose just got picked and the player's current rank, so it's
      // resolved from the new pose, not the stale one still in state.
      const loadedBodyType =
        loaded.avatar?.kind === 'dicebear'
          ? loaded.avatar.options.bodyType
          : createDefaultDiceBearAvatar(encoderName).bodyType;
      setPoseIndex((previousPose) => {
        // Unranked players ("Civil") show the fixed civilian body (pose 0,
        // no rank kit/weapon) rather than a random ranked pose - pose 0 has
        // no f-rank/m-rank decoration to speak of, and is intentionally
        // excluded from POSE_INDICES for exactly that reason (see
        // generatedBodyPools.ts). Falling through to pickPose/pickWeapon
        // here for rankIndex -1 used to render a random Fusilier (rank 1)
        // uniform instead of the civilian portrait.
        if (calculatedRankIndex(loaded) === -1) {
          setWeaponRank(null);
          setWeaponImageIds([]);
          return CIVILIAN_POSE_INDEX;
        }
        const newPose = pickPose(previousPose, loadedBodyType, calculatedRankIndex(loaded));
        setWeaponRank((previousWeaponRank) => {
          const weapon = pickWeapon(
            newPose,
            loadedBodyType,
            calculatedRankIndex(loaded),
            previousWeaponRank,
          );
          setWeaponImageIds(weapon?.imageIds ?? []);
          return weapon?.rank ?? null;
        });
        return newPose;
      });
    });
    // Best-effort, no-ops when the cached count isn't stale or there's no
    // linked GitHub token yet - refreshes quietly in the background rather
    // than blocking the rest of refreshPortrait's synchronous-feeling flow.
    void refreshGithubContributions(() => {}).then(setState);
  };

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      refreshPortrait();
      void window.electronAPI
        ?.getEncoderName()
        .then(setEncoderName)
        .catch(() => setEncoderName(''));
      return;
    }
    if (!open) refreshPortrait();
  }, [open]);

  useEffect(() => {
    if (!state || codeFocused) return;
    const options =
      state.avatar?.kind === 'dicebear' ? state.avatar.options : createDefaultDiceBearAvatar(encoderName);
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
      const bytes = await svgToPngBytes(svg, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT);
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
    const options = { ...avatarOptions, ...changes };
    current.avatar = { kind: 'dicebear', options };
    await saveAchievementsState(current);
    setState({ ...current });
  };

  // keepMounted below: without it, MUI tears down everything inside
  // (including UniformAvatar and its head/body SVG fetches) on every close,
  // so the next open has to redo that whole round trip from scratch instead
  // of reusing what refreshPortrait already prefetched while closed.
  return (
    <Dialog fullWidth keepMounted maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>LJB Service Record</DialogTitle>
      <DialogContent sx={portraitEditorOpen ? { overflow: 'visible' } : undefined}>
        <Stack spacing={3}>
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
