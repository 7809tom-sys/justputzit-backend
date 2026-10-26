export type HomepageSection = {
  moduleId: string;
  position: number;
  pinned: boolean;
};

export function toggleHomepageSection(
  sections: HomepageSection[],
  moduleId: string,
): HomepageSection[] {
  return sections.map((section) => (
    section.moduleId === moduleId
      ? { ...section, pinned: !section.pinned }
      : section
  ));
}

export function reorderHomepageSections(
  sections: HomepageSection[],
  sourceIndex: number,
  targetIndex: number,
): HomepageSection[] {
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= sections.length ||
    targetIndex >= sections.length
  ) {
    return sections;
  }
  const next = [...sections];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next.map((section, position) => ({ ...section, position }));
}
