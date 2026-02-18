'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  BookOpen,
  ChevronRight,
  List,
  MapPin,
  Sparkles,
  GitBranch,
  X,
} from 'lucide-react';
import type { StoryChapter, GeneratedStory } from '@/lib/types';

interface ChapterNavigationProps {
  unifiedStory: GeneratedStory | null;
  repoStories: GeneratedStory[];
  activeChapterId: string | null;
}

interface NavigationItem {
  id: string;
  label: string;
  type: 'section' | 'chapter' | 'repo';
  icon: React.ReactNode;
  depth: number;
  repoId?: string | null;
}

function buildNavigationItems(
  unifiedStory: GeneratedStory | null,
  repoStories: GeneratedStory[]
): NavigationItem[] {
  const items: NavigationItem[] = [];

  // Unified journey section header
  if (unifiedStory) {
    items.push({
      id: 'unified-developer-journey',
      label: 'Developer Journey',
      type: 'section',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      depth: 0,
    });

    // Unified story chapters
    unifiedStory.chapters.forEach((chapter) => {
      items.push({
        id: chapter.anchorId,
        label: chapter.title,
        type: 'chapter',
        icon: <BookOpen className="h-3 w-3" />,
        depth: 1,
      });
    });
  }

  // Milestone timeline section
  items.push({
    id: 'milestone-timeline',
    label: 'Milestone Timeline',
    type: 'section',
    icon: <MapPin className="h-3.5 w-3.5" />,
    depth: 0,
  });

  // Per-repo stories section
  if (repoStories.length > 0) {
    items.push({
      id: 'per-repo-stories',
      label: 'Repository Stories',
      type: 'section',
      icon: <GitBranch className="h-3.5 w-3.5" />,
      depth: 0,
    });

    repoStories.forEach((story) => {
      const repoName = story.repoId?.split('/').pop() || 'Unknown';
      items.push({
        id: `repo-story-${story.repoId || story.id}`,
        label: repoName,
        type: 'repo',
        icon: <GitBranch className="h-3 w-3" />,
        depth: 1,
        repoId: story.repoId,
      });
    });
  }

  return items;
}

function useActiveSection(items: NavigationItem[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleSectionsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSectionsRef.current.set(
            entry.target.id,
            entry.boundingClientRect.top
          );
        } else {
          visibleSectionsRef.current.delete(entry.target.id);
        }
      });

      // Find the topmost visible section
      let topSection: string | null = null;
      let topPosition = Infinity;

      visibleSectionsRef.current.forEach((top, id) => {
        if (top < topPosition && top >= -100) {
          topPosition = top;
          topSection = id;
        }
      });

      if (topSection) {
        setActiveId(topSection);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: [0, 0.1, 0.5],
    });

    // Observe all items
    const timeoutId = setTimeout(() => {
      items.forEach((item) => {
        const element = document.getElementById(item.id);
        if (element && observerRef.current) {
          observerRef.current.observe(element);
        }
      });
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      visibleSectionsRef.current.clear();
    };
  }, [items]);

  return activeId;
}

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    const offset = 100;
    const elementPosition = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: elementPosition - offset,
      behavior: 'smooth',
    });
  }
}

function NavigationList({
  items,
  activeId,
  onItemClick,
}: {
  items: NavigationItem[];
  activeId: string | null;
  onItemClick: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const isActive = activeId === item.id;
        const isSection = item.type === 'section';

        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={cn(
              'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-all duration-200',
              item.depth === 1 && 'ml-3 pl-3',
              isSection && 'mt-3 first:mt-0',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex-shrink-0 transition-colors duration-200',
                isActive ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-muted-foreground',
              )}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {isActive && (
              <span className="ml-auto flex-shrink-0">
                <ChevronRight className="h-3 w-3 text-primary" />
              </span>
            )}
            {item.type === 'repo' && (
              <Badge
                variant="outline"
                className={cn(
                  'ml-auto flex-shrink-0 text-[10px] px-1.5 py-0',
                  isActive && 'border-primary/30 text-primary',
                )}
              >
                repo
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function ChapterNavigation({
  unifiedStory,
  repoStories,
  activeChapterId,
}: ChapterNavigationProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const items = buildNavigationItems(unifiedStory, repoStories);
  const scrollActiveId = useActiveSection(items);

  // Use scroll-based active ID if available, otherwise fall back to prop
  const currentActiveId = scrollActiveId || activeChapterId;

  const handleItemClick = useCallback((id: string) => {
    scrollToSection(id);
    setIsMobileOpen(false);
  }, []);

  const totalChapters = unifiedStory?.chapters.length || 0;
  const totalRepoStories = repoStories.length;

  // Desktop floating sidebar
  const DesktopNav = (
    <div className="hidden xl:block fixed top-28 left-4 2xl:left-8 z-40 w-56 2xl:w-64">
      <div className="rounded-xl border border-border/40 bg-background/80 backdrop-blur-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Navigation
            </h3>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalChapters} chapters · {totalRepoStories} repositories
          </p>
        </div>

        {/* Progress indicator */}
        {currentActiveId && (
          <div className="px-4 py-2 border-b border-border/20">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(
                    5,
                    ((items.findIndex((i) => i.id === currentActiveId) + 1) / items.length) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Navigation items */}
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="p-2">
            <NavigationList
              items={items}
              activeId={currentActiveId}
              onItemClick={handleItemClick}
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  // Mobile floating button + sheet
  const MobileNav = (
    <div className="xl:hidden fixed bottom-6 right-6 z-50">
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground relative"
          >
            <List className="h-5 w-5" />
            {currentActiveId && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background text-primary text-[10px] font-bold flex items-center justify-center border border-primary/30">
                {items.findIndex((i) => i.id === currentActiveId) + 1}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 sm:w-96 p-0">
          <SheetHeader className="px-6 py-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                Story Navigation
              </SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalChapters} chapters · {totalRepoStories} repo stories
            </p>
            {/* Progress */}
            {currentActiveId && (
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(
                        5,
                        ((items.findIndex((i) => i.id === currentActiveId) + 1) / items.length) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {items.findIndex((i) => i.id === currentActiveId) + 1} of {items.length} sections
                </p>
              </div>
            )}
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-4">
              <NavigationList
                items={items}
                activeId={currentActiveId}
                onItemClick={handleItemClick}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );

  // If there are no items to navigate, don't render
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {DesktopNav}
      {MobileNav}
    </>
  );
}
