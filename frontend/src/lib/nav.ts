export type NavItem = {
  to: string;
  label: string;
  title: string;
  number: string;
  description: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Decisione',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        title: 'Dashboard',
        number: '01',
        description: 'Panoramica, ultimo risultato e registro delle esecuzioni.'
      },
      {
        to: '/scenario',
        label: 'Scenario',
        title: 'Scenario Builder',
        number: '02',
        description: 'Configura budget, obiettivo, candidati e vincoli.'
      },
      {
        to: '/result',
        label: 'Risultato',
        title: 'Portafoglio proposto',
        number: '03',
        description: 'Portafoglio, metriche, motivazioni e dati di audit.'
      },
      {
        to: '/compare',
        label: 'Confronto',
        title: 'Confronto scenari',
        number: '04',
        description: 'Confronta lo Scenario A con lo Scenario B.'
      },
      {
        to: '/sensitivity',
        label: 'Sensibilità',
        title: 'Analisi di sensibilità',
        number: '05',
        description: 'Sweep deterministico del budget e stabilità delle scelte.'
      }
    ]
  },
  {
    label: 'Dati',
    items: [
      {
        to: '/buildings',
        label: 'Edifici',
        title: 'Edifici',
        number: '06',
        description: 'Catalogo degli edifici demo.'
      },
      {
        to: '/interventions',
        label: 'Interventi',
        title: 'Interventi candidati',
        number: '07',
        description: 'Catalogo delle opzioni di intervento.'
      },
      {
        to: '/map',
        label: 'Mappa',
        title: 'Mappa degli edifici',
        number: '08',
        description: 'Vista cartografica di Trento.'
      },
      {
        to: '/import',
        label: 'Import',
        title: 'Import CSV edifici',
        number: '09',
        description: 'Validazione e importazione di edifici da CSV.'
      }
    ]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem {
  const sorted = [...NAV_ITEMS].sort((a, b) => b.to.length - a.to.length);
  return (
    sorted.find((item) =>
      item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
    ) ?? NAV_ITEMS[0]
  );
}
