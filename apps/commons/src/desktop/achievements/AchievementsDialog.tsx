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
import ShuffleIcon from '@mui/icons-material/Shuffle';
import PrintIcon from '@mui/icons-material/Print';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useEffect, useRef, useState } from 'react';
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
  RANK_MEDALS,
  RANK_NAMES,
  RARE_ACHIEVEMENTS,
  SPECIAL_ACHIEVEMENTS,
  TOTAL_ACHIEVEMENTS,
  findAchievementDef,
} from './definitions';
import { aggregateGlobalMetrics, countUnlocked, currentRankIndex } from './evaluate';
import {
  MedalIcon,
  METRIC_RIBBONS,
  SPECIAL_RIBBON,
  tierForRankIndex,
  type MedalMetric,
} from './MedalIcon';
import {
  BODY_TYPES,
  createDefaultDiceBearAvatar,
  diceBearAvatarUrl,
  EARRINGS_VARIANTS,
  EYE_VARIANTS,
  EYEBROW_VARIANTS,
  FEATURES_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_VARIANTS,
  HAIR_COLORS,
  MOUTH_VARIANTS,
  SKIN_COLORS,
} from './dicebear';
import { buildBodyUrl, pickBackgroundKey, pickPose, pickWeapon, UniformAvatar } from './UniformAvatar';
import { loadAchievementsState, saveAchievementsState } from './store';
import type { AchievementsState, GlobalMetrics, UnlockedAchievement } from './types';

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
  texts: 'Documents saved',
  tags: 'Tags added',
  disambiguated: 'Tags disambiguated',
  places: 'Places disambiguated',
  entities: 'Entities on file',
};

const metricValue = (global: GlobalMetrics, metric: string): number => {
  switch (metric) {
    case 'texts':
      return global.texts;
    case 'tags':
      return global.tags;
    case 'disambiguated':
      return global.disambiguated;
    case 'places':
      return global.places;
    case 'entities':
      return global.entities;
    default:
      return 0;
  }
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

/** The highest rank held across all metrics, for the header line. */
const highestCommission = (state: AchievementsState): string | null => {
  let best: { rankIndex: number; medalName: string } | null = null;
  for (const medal of RANK_MEDALS) {
    const rankIndex = currentRankIndex(state, medal.metric);
    if (rankIndex >= 0 && (!best || rankIndex > best.rankIndex)) {
      best = { rankIndex, medalName: medal.medalName };
    }
  }
  return best ? `${RANK_NAMES[best.rankIndex]}, ${best.medalName}` : null;
};

export const AchievementsDialog = ({ onClose, open }: AchievementsDialogProps) => {
  const { notifyViaSnackbar } = useActions().ui;
  const [state, setState] = useState<AchievementsState | null>(null);
  const [encoderName, setEncoderName] = useState('');
  const [seedDraft, setSeedDraft] = useState('');
  const [backgroundKey, setBackgroundKey] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState<number | null>(null);
  const [weaponRank, setWeaponRank] = useState<number | null>(null);
  const [weaponImageIds, setWeaponImageIds] = useState<string[]>([]);
  const [portraitEditorOpen, setPortraitEditorOpen] = useState(false);
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
      setBackgroundKey((previous) => pickBackgroundKey(highestRankIndexOf(loaded), previous));
      // Pose and weapon are randomized the same way as the backdrop above
      // (Daniel: "pose and weapons will be random"). Weapon depends on
      // which pose just got picked and the player's current rank, so it's
      // resolved from the new pose, not the stale one still in state.
      setPoseIndex((previousPose) => {
        const newPose = pickPose(previousPose);
        setWeaponRank((previousWeaponRank) => {
          const weapon = pickWeapon(newPose, highestRankIndexOf(loaded), previousWeaponRank);
          setWeaponImageIds(weapon?.imageIds ?? []);
          return weapon?.rank ?? null;
        });
        return newPose;
      });
    });
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
    if (!state) return;
    setSeedDraft(
      state.avatar?.kind === 'dicebear'
        ? state.avatar.options.seed
        : createDefaultDiceBearAvatar(encoderName).seed,
    );
  }, [encoderName, state]);

  if (!state || !backgroundKey || poseIndex === null) {
    return <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open} />;
  }

  const global = aggregateGlobalMetrics(state);
  const unlockedCount = countUnlocked(state);
  const percent = Math.round((unlockedCount / TOTAL_ACHIEVEMENTS) * 100);
  const decorations = collectDecorations(state);
  const commission = highestCommission(state);
  const avatarOptions =
    state.avatar?.kind === 'dicebear'
      ? state.avatar.options
      : createDefaultDiceBearAvatar(encoderName);
  const avatarUrl = diceBearAvatarUrl(avatarOptions);
  const serviceSince = new Date(state.installedAt).toLocaleDateString();
  const highestRankIndex = highestRankIndexOf(state);
  const weaponSelection = weaponRank !== null ? { imageIds: weaponImageIds, rank: weaponRank } : null;
  const bodyBackUrl = buildBodyUrl(poseIndex, avatarOptions.bodyType, highestRankIndex, weaponSelection, 'back');
  const bodyFrontUrl = buildBodyUrl(poseIndex, avatarOptions.bodyType, highestRankIndex, weaponSelection, 'front');
  const serviceRibbons = RANK_MEDALS.filter(
    (medal) => currentRankIndex(state, medal.metric) >= 0,
  ).map((medal) => METRIC_RIBBONS[medal.metric] ?? SPECIAL_RIBBON);
  const uniformMedals = [
    ...RANK_MEDALS.flatMap((medal) => {
      const rankIndex = currentRankIndex(state, medal.metric);
      return Array.from({ length: rankIndex + 1 }, (_, earnedRankIndex) => ({
        label: `${RANK_NAMES[earnedRankIndex]} — ${medal.medalName}`,
        metric: medal.metric as MedalMetric,
        tier: tierForRankIndex(earnedRankIndex),
      }));
    }),
    ...decorations.map((decoration) => ({
      label: decoration.name,
      metric: 'special' as const,
      tier: 'gold' as const,
    })),
  ];

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
        serviceSince,
        totalAchievements: TOTAL_ACHIEVEMENTS,
        unlockedCount,
      });
      const bytes = await svgToPngBytes(svg, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT);
      const suggestedName = `${(encoderName.trim() || 'service-record')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}-service-record.png`;
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
        const copyCode = () => void window.electronAPI?.writeClipboardRich?.({ text: flow.userCode });
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
          },
          unlockedCount,
          totalAchievements: TOTAL_ACHIEVEMENTS,
          avatarPngBase64,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Submission failed.');

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
    if (!current.unlocked['character-development']) {
      current.unlocked['character-development'] = { at: new Date().toISOString() };
      const def = findAchievementDef('character-development');
      if (def) {
        notifyViaSnackbar({
          message: `🎖️ Achievement unlocked: ${def.name} — ${def.description}`,
          options: { variant: 'success', autoHideDuration: 7000 },
        });
      }
    }
    await saveAchievementsState(current);
    setState({ ...current });
  };

  const randomizeAvatar = () => {
    const seed = crypto.randomUUID().slice(0, 8);
    setSeedDraft(seed);
    void updateAvatar({ seed });
  };

  // keepMounted below: without it, MUI tears down everything inside
  // (including UniformAvatar and its head/body SVG fetches) on every close,
  // so the next open has to redo that whole round trip from scratch instead
  // of reusing what refreshPortrait already prefetched while closed.
  return (
    <Dialog fullWidth keepMounted maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>LJB Service Record</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Officer header */}
          <Stack alignItems="center" direction="row" spacing={2}>
            <Box
              onClick={() => setPortraitEditorOpen((openEditor) => !openEditor)}
              sx={{ cursor: 'pointer', flexShrink: 0, textAlign: 'center' }}
              title={portraitEditorOpen ? 'Close portrait editor' : 'Edit portrait'}
            >
              <UniformAvatar
                headImageUrl={avatarUrl}
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
                {commission ?? 'Unranked. The corpus awaits.'}
              </Typography>
              <Typography color="text.secondary" variant="caption">
                In service since {serviceSince}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                <Button
                  onClick={() => void printCertificate()}
                  size="small"
                  startIcon={<PrintIcon fontSize="small" />}
                  sx={{ px: 0.5, minWidth: 0 }}
                >
                  Print certificate
                </Button>
                <Button
                  onClick={() => void submitToLeaderboard()}
                  size="small"
                  startIcon={<EmojiEventsIcon fontSize="small" />}
                  sx={{ px: 0.5, minWidth: 0 }}
                >
                  Submit to leaderboard
                </Button>
              </Stack>
            </Stack>
          </Stack>
          {portraitEditorOpen && (
            <Box>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <FormControl size="small" sx={{ minWidth: 72 }}>
                  <Select
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
                  label="Seed"
                  onBlur={() => {
                    const seed = seedDraft.trim() || 'leaf-writer';
                    setSeedDraft(seed);
                    if (seed !== avatarOptions.seed) void updateAvatar({ seed });
                  }}
                  onChange={(event) => setSeedDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  size="small"
                  sx={{ minWidth: 240, flex: '1 1 240px' }}
                  value={seedDraft}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <IconButton
                          aria-label="Randomize seed"
                          edge="end"
                          onClick={randomizeAvatar}
                          size="small"
                          title="Randomize seed"
                        >
                          <ShuffleIcon fontSize="small" />
                        </IconButton>
                      ),
                    },
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Eyebrows"
                    value={avatarOptions.eyebrowsVariant}
                    onChange={(event) => void updateAvatar({ eyebrowsVariant: event.target.value })}
                  >
                    {EYEBROW_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        value={variant}
                      >{`Eyebrows ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Eyes"
                    value={avatarOptions.eyesVariant}
                    onChange={(event) => void updateAvatar({ eyesVariant: event.target.value })}
                  >
                    {EYE_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        value={variant}
                      >{`Eyes ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Mouth"
                    value={avatarOptions.mouthVariant}
                    onChange={(event) => void updateAvatar({ mouthVariant: event.target.value })}
                  >
                    {MOUTH_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        value={variant}
                      >{`Mouth ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Features"
                    value={avatarOptions.featuresProbability ? avatarOptions.featuresVariant : 'none'}
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { featuresProbability: 0 }
                          : { featuresVariant: event.target.value, featuresProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">No feature</MenuItem>
                    {FEATURES_VARIANTS.map((variant) => (
                      <MenuItem key={variant} value={variant}>
                        {variant.charAt(0).toUpperCase() + variant.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Glasses"
                    value={avatarOptions.glassesProbability ? avatarOptions.glassesVariant : 'none'}
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { glassesProbability: 0 }
                          : { glassesVariant: event.target.value, glassesProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">No glasses</MenuItem>
                    {GLASSES_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        value={variant}
                      >{`Glasses ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Hair"
                    value={avatarOptions.hairVariant}
                    onChange={(event) => void updateAvatar({ hairVariant: event.target.value })}
                  >
                    {HAIR_VARIANTS.map((variant) => (
                      <MenuItem key={variant} value={variant}>
                        {variant.startsWith('long') ? 'Long hair' : 'Short hair'}{' '}
                        {variant.slice(-2)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
                    aria-label="Earrings"
                    value={avatarOptions.earringsProbability ? avatarOptions.earringsVariant : 'none'}
                    onChange={(event) =>
                      void updateAvatar(
                        event.target.value === 'none'
                          ? { earringsProbability: 0 }
                          : { earringsVariant: event.target.value, earringsProbability: 100 },
                      )
                    }
                  >
                    <MenuItem value="none">No earrings</MenuItem>
                    {EARRINGS_VARIANTS.map((variant) => (
                      <MenuItem
                        key={variant}
                        value={variant}
                      >{`Earrings ${variant.slice(-2)}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 116 }}>
                  <Select
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
          <Stack spacing={1}>
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
                  <Stack alignItems="center" direction="row" spacing={2}>
                    <MedalIcon
                      dimmed={rankIndex < 0}
                      metric={medal.metric as MedalMetric}
                      size={44}
                      tier={tierForRankIndex(Math.max(0, rankIndex))}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="subtitle2">{medal.medalName}</Typography>
                        <Typography color="text.secondary" variant="caption">
                          {METRIC_LABELS[medal.metric]}: {value.toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography color="text.secondary" variant="caption">
                        {rankIndex >= 0 ? RANK_NAMES[rankIndex] : 'Not yet decorated'}
                        {nextThreshold
                          ? ` — ${value.toLocaleString()} / ${nextThreshold.toLocaleString()} to ${RANK_NAMES[rankIndex + 1]}`
                          : rankIndex >= 0
                            ? ' — highest rank attained'
                            : ` — ${medal.thresholds[0]!.toLocaleString()} to ${RANK_NAMES[0]}`}
                      </Typography>
                      <LinearProgress
                        sx={{ height: 4, borderRadius: 1, mt: 0.5 }}
                        value={rankIndex >= 0 || value > 0 ? towardNext : 0}
                        variant="determinate"
                      />
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

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
