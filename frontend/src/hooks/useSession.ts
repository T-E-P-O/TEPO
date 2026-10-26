import { useEffect, useMemo, useState } from 'react';
import {
  loadLastResult,
  loadScenario,
  subscribeSession,
  type LastResult
} from '../services/scenarioStore';
import type { StoredScenario } from '../types';

export type SessionSnapshot = {
  last: LastResult | null;
  scenarioA: StoredScenario | null;
  scenarioB: StoredScenario | null;
  version: number;
};

export function useSession(): SessionSnapshot {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribeSession(() => setVersion((current) => current + 1));
  }, []);

  return useMemo(
    () => ({
      last: loadLastResult(),
      scenarioA: loadScenario('A'),
      scenarioB: loadScenario('B'),
      version
    }),
    [version]
  );
}
