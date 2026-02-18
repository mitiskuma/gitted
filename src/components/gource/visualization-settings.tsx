'use client';

import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { GourceSettings } from '@/lib/types';
import {
  DEFAULT_GOURCE_SETTINGS,
  FILE_CATEGORY_COLORS,
  FileCategory,
} from '@/lib/types';

// ─── Icons ──────────────────────────────────────────────────────────────────

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RotateCcwIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface VisualizationSettingsProps {
  settings: GourceSettings;
  onSettingsChange: (settings: Partial<GourceSettings>) => void;
  onReset?: () => void;
}

// ─── File Category Metadata ─────────────────────────────────────────────────

const FILE_CATEGORY_META: Record<FileCategory, { label: string; extensions: string }> = {
  [FileCategory.CODE]: {
    label: 'Code',
    extensions: '.ts, .js, .py, .go, .rs',
  },
  [FileCategory.MARKUP]: {
    label: 'Markup',
    extensions: '.html, .xml, .svg, .vue',
  },
  [FileCategory.CONFIG]: {
    label: 'Config',
    extensions: '.json, .yaml, .toml, .env',
  },
  [FileCategory.DOCUMENTATION]: {
    label: 'Docs',
    extensions: '.md, .txt, .rst, .adoc',
  },
  [FileCategory.ASSET]: {
    label: 'Assets',
    extensions: '.css, .png, .jpg, .woff2',
  },
  [FileCategory.TEST]: {
    label: 'Tests',
    extensions: '.test, .spec, .snap',
  },
  [FileCategory.BUILD]: {
    label: 'Build',
    extensions: 'Dockerfile, Makefile, .gradle',
  },
  [FileCategory.DATA]: {
    label: 'Data',
    extensions: '.csv, .json, .sqlite',
  },
  [FileCategory.OTHER]: {
    label: 'Other',
    extensions: 'Miscellaneous files',
  },
};

const BACKGROUND_PRESETS = [
  { label: 'Deep Space', value: '#0a0a0f' },
  { label: 'Dark Navy', value: '#0f172a' },
  { label: 'Midnight', value: '#111827' },
  { label: 'Charcoal', value: '#1a1a2e' },
  { label: 'Pure Black', value: '#000000' },
  { label: 'Dark Purple', value: '#1e1028' },
  { label: 'Dark Green', value: '#0a1f0c' },
  { label: 'Dark Blue', value: '#0c1425' },
];

// ─── Section Component ──────────────────────────────────────────────────────

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function VisualizationSettings({
  settings,
  onSettingsChange,
  onReset,
}: VisualizationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateFilterEnabled, setDateFilterEnabled] = useState(
    settings.dateFilter !== null,
  );
  const [dateStart, setDateStart] = useState(
    settings.dateFilter?.start || '',
  );
  const [dateEnd, setDateEnd] = useState(settings.dateFilter?.end || '');

  const handleNodeSizeChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ nodeSize: value[0] });
    },
    [onSettingsChange],
  );

  const handleEdgeThicknessChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ edgeThickness: value[0] });
    },
    [onSettingsChange],
  );

  const handleSpringStiffnessChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ springStiffness: value[0] });
    },
    [onSettingsChange],
  );

  const handleRepulsionForceChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ repulsionForce: value[0] });
    },
    [onSettingsChange],
  );

  const handleNodeFadeTimeChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ nodeFadeTime: value[0] * 1000 });
    },
    [onSettingsChange],
  );

  const handleMaxVisibleNodesChange = useCallback(
    (value: number[]) => {
      onSettingsChange({ maxVisibleNodes: value[0] });
    },
    [onSettingsChange],
  );

  const handleBackgroundChange = useCallback(
    (color: string) => {
      onSettingsChange({ backgroundColor: color });
    },
    [onSettingsChange],
  );

  const handleExtensionColorChange = useCallback(
    (category: FileCategory, color: string) => {
      const newColors = { ...settings.extensionColors };
      const categoryExtensions: Record<FileCategory, string[]> = {
        [FileCategory.CODE]: ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php'],
        [FileCategory.MARKUP]: ['html', 'xml', 'svg', 'vue', 'svelte'],
        [FileCategory.CONFIG]: ['json', 'yaml', 'yml', 'toml', 'env'],
        [FileCategory.DOCUMENTATION]: ['md', 'mdx', 'txt', 'rst'],
        [FileCategory.ASSET]: ['css', 'scss', 'png', 'jpg', 'gif', 'woff2'],
        [FileCategory.TEST]: ['test', 'spec', 'snap'],
        [FileCategory.BUILD]: ['Makefile', 'Dockerfile', 'gradle'],
        [FileCategory.DATA]: ['csv', 'tsv', 'sqlite', 'db'],
        [FileCategory.OTHER]: [],
      };

      const exts = categoryExtensions[category] || [];
      for (const ext of exts) {
        newColors[ext] = color;
      }

      onSettingsChange({ extensionColors: newColors });
    },
    [onSettingsChange, settings.extensionColors],
  );

  const handleDateFilterToggle = useCallback(
    (enabled: boolean) => {
      setDateFilterEnabled(enabled);
      if (!enabled) {
        onSettingsChange({ dateFilter: null });
      } else if (dateStart && dateEnd) {
        const start = dateStart;
        const end = dateEnd;
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        const totalDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
        onSettingsChange({
          dateFilter: { start, end, totalDays },
        });
      }
    },
    [onSettingsChange, dateStart, dateEnd],
  );

  const handleDateStartChange = useCallback(
    (value: string) => {
      setDateStart(value);
      if (dateFilterEnabled && value && dateEnd) {
        const startMs = new Date(value).getTime();
        const endMs = new Date(dateEnd).getTime();
        const totalDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
        onSettingsChange({
          dateFilter: { start: value, end: dateEnd, totalDays },
        });
      }
    },
    [onSettingsChange, dateFilterEnabled, dateEnd],
  );

  const handleDateEndChange = useCallback(
    (value: string) => {
      setDateEnd(value);
      if (dateFilterEnabled && dateStart && value) {
        const startMs = new Date(dateStart).getTime();
        const endMs = new Date(value).getTime();
        const totalDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
        onSettingsChange({
          dateFilter: { start: dateStart, end: value, totalDays },
        });
      }
    },
    [onSettingsChange, dateFilterEnabled, dateStart],
  );

  const handleReset = useCallback(() => {
    setDateFilterEnabled(false);
    setDateStart('');
    setDateEnd('');
    if (onReset) {
      onReset();
    } else {
      onSettingsChange({ ...DEFAULT_GOURCE_SETTINGS });
    }
  }, [onReset, onSettingsChange]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-white/10 bg-black/60 text-zinc-300 backdrop-blur-md hover:border-white/20 hover:bg-black/80 hover:text-white"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Visualization Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[360px] overflow-y-auto border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl sm:w-[400px]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-white">
            <SettingsIcon className="h-5 w-5 text-blue-400" />
            Visualization Settings
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Fine-tune the Gource visualization rendering, physics, and colors.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── Rendering ─────────────────────────────────────────────── */}
          <SettingsSection title="Rendering">
            {/* Node Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">Node Size</Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {settings.nodeSize}px
                </Badge>
              </div>
              <Slider
                value={[settings.nodeSize]}
                onValueChange={handleNodeSizeChange}
                min={2}
                max={20}
                step={0.5}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                Controls the radius of file nodes in the visualization.
              </p>
            </div>

            {/* Edge Thickness */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">Edge Thickness</Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {settings.edgeThickness.toFixed(1)}px
                </Badge>
              </div>
              <Slider
                value={[settings.edgeThickness]}
                onValueChange={handleEdgeThicknessChange}
                min={0.5}
                max={5}
                step={0.25}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                Thickness of directory connection lines.
              </p>
            </div>

            {/* Max Visible Nodes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">
                  Max Visible Nodes
                </Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {settings.maxVisibleNodes.toLocaleString()}
                </Badge>
              </div>
              <Slider
                value={[settings.maxVisibleNodes]}
                onValueChange={handleMaxVisibleNodesChange}
                min={500}
                max={10000}
                step={500}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                Limit for performance. Lower for smoother rendering on large
                repos.
              </p>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Visibility Toggles ────────────────────────────────────── */}
          <SettingsSection title="Display">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">Show Labels</Label>
                  <p className="text-[11px] text-zinc-500">
                    Directory and file name labels
                  </p>
                </div>
                <Switch
                  checked={settings.showLabels}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ showLabels: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">
                    Show Avatars
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Contributor GitHub profile images
                  </p>
                </div>
                <Switch
                  checked={settings.showAvatars}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ showAvatars: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">
                    Commit Beams
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Animated lines from contributors to files
                  </p>
                </div>
                <Switch
                  checked={settings.showCommitBeams}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ showCommitBeams: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">
                    Bloom / Glow
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Glow effects on active nodes and beams
                  </p>
                </div>
                <Switch
                  checked={settings.showGlowEffects}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ showGlowEffects: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">Particles</Label>
                  <p className="text-[11px] text-zinc-500">
                    Particle burst on each file modification
                  </p>
                </div>
                <Switch
                  checked={settings.showParticles}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ showParticles: checked })
                  }
                />
              </div>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Playback ──────────────────────────────────────────────── */}
          <SettingsSection title="Playback">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">
                    Skip Dead Time
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Fast-forward through periods with no commits
                  </p>
                </div>
                <Switch
                  checked={settings.skipDeadTime}
                  onCheckedChange={(checked: boolean) =>
                    onSettingsChange({ skipDeadTime: checked })
                  }
                />
              </div>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Physics ───────────────────────────────────────────────── */}
          <SettingsSection title="Physics">
            {/* Spring Stiffness */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">
                  Spring Stiffness
                </Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {settings.springStiffness.toFixed(3)}
                </Badge>
              </div>
              <Slider
                value={[settings.springStiffness]}
                onValueChange={handleSpringStiffnessChange}
                min={0.001}
                max={0.1}
                step={0.001}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                How tightly directory branches pull files together.
              </p>
            </div>

            {/* Repulsion Force */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">
                  Repulsion Force
                </Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {settings.repulsionForce}
                </Badge>
              </div>
              <Slider
                value={[settings.repulsionForce]}
                onValueChange={handleRepulsionForceChange}
                min={10}
                max={500}
                step={10}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                How strongly nodes push each other apart.
              </p>
            </div>

            {/* Node Fade Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-zinc-300">
                  Node Fade Time
                </Label>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-zinc-800 font-mono text-xs text-zinc-400"
                >
                  {(settings.nodeFadeTime / 1000).toFixed(0)}s
                </Badge>
              </div>
              <Slider
                value={[settings.nodeFadeTime / 1000]}
                onValueChange={handleNodeFadeTimeChange}
                min={5}
                max={120}
                step={5}
                className="w-full"
              />
              <p className="text-[11px] text-zinc-500">
                How long before inactive files begin to fade out.
              </p>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Background ────────────────────────────────────────────── */}
          <SettingsSection title="Background">
            <div className="space-y-2">
              <Label className="text-sm text-zinc-300">Background Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_PRESETS.map((preset) => (
                  <TooltipProvider key={preset.value}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={`h-8 w-full rounded-md border transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                            settings.backgroundColor === preset.value
                              ? 'border-blue-500 ring-1 ring-blue-500/50'
                              : 'border-white/10 hover:border-white/25'
                          }`}
                          style={{ backgroundColor: preset.value }}
                          onClick={() => handleBackgroundChange(preset.value)}
                          aria-label={preset.label}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">{preset.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs text-zinc-500">Custom:</Label>
                <Input
                  value={settings.backgroundColor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                      handleBackgroundChange(v);
                    }
                  }}
                  className="h-7 w-24 border-white/10 bg-zinc-800 font-mono text-xs"
                  placeholder="#0a0a0f"
                />
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleBackgroundChange(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </div>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── File Extension Colors ─────────────────────────────────── */}
          <SettingsSection title="File Extension Colors">
            <div className="flex items-center gap-2 pb-1">
              <PaletteIcon className="h-4 w-4 text-zinc-500" />
              <p className="text-[11px] text-zinc-500">
                Customize colors by file category. Changes apply to all
                extensions in that category.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(FILE_CATEGORY_COLORS) as FileCategory[]).map(
                (category) => {
                  const meta = FILE_CATEGORY_META[category];
                  const currentColor =
                    FILE_CATEGORY_COLORS[category] || '#94a3b8';

                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between rounded-md border border-white/5 bg-zinc-900/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: currentColor }}
                        />
                        <div>
                          <p className="text-xs font-medium text-zinc-300">
                            {meta.label}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {meta.extensions}
                          </p>
                        </div>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="h-6 w-6 rounded border border-white/10 transition-all hover:scale-110 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            style={{ backgroundColor: currentColor }}
                            aria-label={`Change ${meta.label} color`}
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          side="left"
                          className="w-44 border-white/10 bg-zinc-900/95 backdrop-blur-xl"
                        >
                          <div className="space-y-2">
                            <Label className="text-xs text-zinc-400">
                              {meta.label} color
                            </Label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={currentColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  handleExtensionColorChange(
                                    category,
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                              />
                              <Input
                                value={currentColor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const v = e.target.value;
                                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                                    handleExtensionColorChange(category, v);
                                  }
                                }}
                                className="h-8 border-white/10 bg-zinc-800 font-mono text-xs"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                },
              )}
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Date Filter ───────────────────────────────────────────── */}
          <SettingsSection title="Date Filter">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm text-zinc-300">
                    Enable Date Filter
                  </Label>
                  <p className="text-[11px] text-zinc-500">
                    Restrict visualization to a date range
                  </p>
                </div>
                <Switch
                  checked={dateFilterEnabled}
                  onCheckedChange={handleDateFilterToggle}
                />
              </div>

              {dateFilterEnabled && (
                <div className="space-y-2 rounded-md border border-white/5 bg-zinc-900/50 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">From</Label>
                    <Input
                      type="date"
                      value={dateStart}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateStartChange(e.target.value)}
                      className="h-8 border-white/10 bg-zinc-800 text-xs text-zinc-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">To</Label>
                    <Input
                      type="date"
                      value={dateEnd}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDateEndChange(e.target.value)}
                      className="h-8 border-white/10 bg-zinc-800 text-xs text-zinc-300"
                    />
                  </div>
                  {dateStart && dateEnd && (
                    <p className="text-[11px] text-zinc-500">
                      Showing{' '}
                      {Math.max(
                        1,
                        Math.ceil(
                          (new Date(dateEnd).getTime() -
                            new Date(dateStart).getTime()) /
                            (1000 * 60 * 60 * 24),
                        ),
                      )}{' '}
                      days of activity
                    </p>
                  )}
                </div>
              )}
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          {/* ── Reset ─────────────────────────────────────────────────── */}
          <div className="pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full border-white/10 bg-zinc-900 text-zinc-300 hover:border-red-500/30 hover:bg-red-950/20 hover:text-red-400"
            >
              <RotateCcwIcon className="mr-2 h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-zinc-600">
              Restores all settings to their original values
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default VisualizationSettings;
