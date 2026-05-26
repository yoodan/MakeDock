'use client';

import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { MacOSDock, type DockAppearance } from '@/components/ui/shadcn-io/mac-os-dock';
import { SortableAppItem } from '@/components/sortable-app-item';
import { AppSelector } from '@/components/app-selector';
import { ExportMenu } from '@/components/export-menu';
import { ThemeSelector } from '@/components/theme-selector';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Github } from 'lucide-react';
import { defaultApps, type DockApp } from '@/lib/dock-apps';
import { themes, defaultTheme, type Theme } from '@/lib/themes';
import Link from 'next/dist/client/link';

export function DockBuilder() {
  const [apps, setApps] = useState<DockApp[]>(defaultApps);
  const [openApps, setOpenApps] = useState<string[]>([]);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(defaultTheme);
  const [dockAppearance, setDockAppearance] = useState<DockAppearance>('dark');
  const dockPreviewRef = useRef<HTMLDivElement>(null);
  const dndContextId = useId();

  // Only render DndContext after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setApps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        // Prevent moving items before Finder (index 0)
        if (newIndex === 0) return items;
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleAddApp = useCallback((app: DockApp) => {
    setApps((prev) => [...prev, app]);
  }, []);

  const handleRemoveApp = useCallback((appId: string) => {
    setApps((prev) => prev.filter((app) => app.id !== appId));
  }, []);

  const handleAppClick = useCallback((appId: string) => {
    setOpenApps((prev) => 
      prev.includes(appId) 
        ? prev.filter((id) => id !== appId) 
        : [...prev, appId]
    );
  }, []);

  const handleToggleAllApps = useCallback((open: boolean) => {
    setAllAppsOpen(open);
    if (open) {
      // Open all apps with staggered animation
      apps.forEach((app, index) => {
        setTimeout(() => {
          setOpenApps((prev) => 
            prev.includes(app.id) ? prev : [...prev, app.id]
          );
        }, index * 50); // 50ms delay between each app
      });
    } else {
      // Close all apps with staggered animation
      apps.forEach((app, index) => {
        setTimeout(() => {
          setOpenApps((prev) => prev.filter((id) => id !== app.id));
        }, index * 50);
      });
    }
  }, [apps]);

  const handleToggleDockAppearance = useCallback((light: boolean) => {
    setDockAppearance(light ? 'light' : 'dark');
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2">
                <span>
                    <Image src="/logo.png" alt="MakeDock Logo" width={50} height={50} style={{ borderRadius: '10px' }}/>
                </span>
          <h1 className="text-xl font-semibold text-zinc-900">
            MakeDock
          </h1>
            </div>
          <Button
            variant="outline"
            size="icon-lg"
            asChild
          >
            <Link
              href="https://github.com/MatejBendik/MakeDock"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
                <img src="https://icones.pro/wp-content/uploads/2021/06/icone-github-noir.png" width={30} height={30} alt="GitHub Logo" />
            </Link>
          </Button>
        </div>
      </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col items-center justify-start gap-8 px-6 py-12">
        {/* App Editor Section */}
        <section className="w-full max-w-4xl mb-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Drag and drop to sort
            </span>
            <svg
              className="h-4 w-4 text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M7 7l10 10M17 7v10H7" />
            </svg>
          </div>

          {mounted ? (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={apps.map((app) => app.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {apps.map((app, index) => (
                    <SortableAppItem
                      key={app.id}
                      app={app}
                      onRemove={handleRemoveApp}
                      isLocked={index === 0 && app.id === 'finder'}
                    />
                  ))}
                  {apps.length < 24 && (
                    <AppSelector selectedApps={apps} onAddApp={handleAddApp} />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <img
                    src={app.icon}
                    alt={app.name}
                    className="h-12 w-12 object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Preview Section */}
        <section className="mt-4 w-full max-w-6xl">
          <div 
            className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800"
          >
            {/* Preview Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-2 ml-2 sm:ml-0 py-2 sm:px-4 dark:border-zinc-700">
              <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">Preview</span>
                {mounted && (
                  <>
                    {/* Separator */}
                    <div className="ml-2 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                    <ThemeSelector
                      selectedTheme={selectedTheme}
                      onThemeChange={setSelectedTheme}
                    />
                    {/* Separator */}
                    <div className="mr-2 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                    {/* Dock Appearance Switch */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Switch
                        id="dock-appearance"
                        checked={dockAppearance === 'light'}
                        onCheckedChange={handleToggleDockAppearance}
                      />
                      <label
                        htmlFor="dock-appearance"
                        className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer whitespace-nowrap"
                      >
                        Light Dock
                      </label>
                    </div>
                    {/* Separator */}
                    <div className="mr-2 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                    {/* Open All Apps Switch */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Switch
                        id="open-all-apps"
                        checked={allAppsOpen}
                        onCheckedChange={handleToggleAllApps}
                      />
                      <label
                        htmlFor="open-all-apps"
                        className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer whitespace-nowrap"
                      >
                        Open All
                      </label>
                    </div>
                  </>
                )}
              </div>
              {mounted && <ExportMenu dockRef={dockPreviewRef} theme={selectedTheme} />}
            </div>

            {/* macOS-like desktop background */}
            <div 
              ref={dockPreviewRef}
              className="flex min-h-[500px] items-center justify-center"
              style={{
                background: selectedTheme.gradient,
              }}
            >
              <div className="flex items-center justify-center p-8">
                {apps.length > 0 ? (
                  <MacOSDock
                    apps={apps}
                    onAppClick={handleAppClick}
                    openApps={openApps}
                    appearance={dockAppearance}
                  />
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-2xl bg-zinc-800/50 px-8 backdrop-blur-md">
                    <span className="text-sm text-zinc-400">
                      Add apps to see the dock preview
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-sm text-black">
          Made with{' '}
          <span className="text-red-500">❤</span>
          {' '}by{' '}
          <Link
            href="https://x.com/BendikMatej"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-700 hover:underline"
          >
            Matej Bendík
          </Link>
        </p>
      </footer>
    </div>
  );
}
