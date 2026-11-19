/** Sekcje (widoki) projektu */
export type Tab = 'plan' | 'list' | 'elements' | 'joints' | '3d' | 'drawings' | 'settings';

/** Etapy pracy – główna nawigacja projektu (dolny pasek na telefonie, górny na komputerze) */
export type StageId = 'wymiary' | 'materialy' | 'montaz';

export interface StageView {
  id: Tab;
  label: string;
}

export interface Stage {
  id: StageId;
  label: string;
  views: StageView[];
}

/**
 * Etapy idą za kolejnością roboty: wymiary → materiały → montaż. Każdy ma dwa widoki.
 * Na komputerze lista ścian ma obok siebie listę zakupów, więc nazywa się szerzej.
 */
export function stagesFor(wide: boolean): Stage[] {
  return [
    {
      id: 'wymiary',
      label: 'Wymiary',
      views: [
        { id: 'plan', label: 'Plan' },
        { id: 'elements', label: wide ? 'Ściany, sufity i materiały' : 'Ściany i sufity' },
      ],
    },
    {
      id: 'materialy',
      label: 'Materiały',
      views: [
        { id: 'list', label: 'Zakupy' },
        { id: 'joints', label: 'Wykończenie' },
      ],
    },
    {
      id: 'montaz',
      label: 'Montaż',
      views: [
        { id: 'drawings', label: 'Rysunki' },
        { id: '3d', label: 'Widok 3D' },
      ],
    },
  ];
}

/** Etap, do którego należy widok; ustawienia są poza etapami */
export function stageOf(tab: Tab): StageId | undefined {
  return stagesFor(false).find((s) => s.views.some((v) => v.id === tab))?.id;
}

/** Widok otwierany po wybraniu etapu: ostatnio oglądany w tym etapie, a za pierwszym razem pierwszy */
export function viewForStage(stage: StageId, last: Partial<Record<StageId, Tab>>): Tab {
  const views = stagesFor(false).find((s) => s.id === stage)!.views;
  const remembered = last[stage];
  return remembered && views.some((v) => v.id === remembered) ? remembered : views[0].id;
}
