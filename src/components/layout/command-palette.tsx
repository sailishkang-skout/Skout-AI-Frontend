"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { homeNav, pipelineNav, prospectsNav, engageNav, workflowsNav, intelligenceNav, settingsNav } from "@/components/workspace/sidebar";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const displayGroups = [
    ...homeNav,
    ...pipelineNav,
    ...prospectsNav,
    ...engageNav,
    ...workflowsNav,
    ...intelligenceNav,
    ...settingsNav,
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] sm:pt-[25vh]">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)} 
      />
      <Command
        className="relative z-50 flex h-full w-full max-w-[640px] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl sm:h-auto"
        label="Global Command Menu"
      >
        <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input
            autoFocus
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Type a command or search..."
          />
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto overflow-x-hidden p-2 pb-4">
          <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>
          
          {displayGroups.map((group) => (
            <Command.Group key={group.label} heading={group.label} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {group.items.map((item) => {
                if (item.children) {
                  return item.children.map(child => (
                    <Command.Item
                      key={child.href}
                      onSelect={() => runCommand(() => router.push(child.href))}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <child.icon className="mr-2 h-4 w-4" />
                      {child.label}
                    </Command.Item>
                  ));
                }
                return (
                  <Command.Item
                    key={item.href}
                    onSelect={() => runCommand(() => router.push(item.href))}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
