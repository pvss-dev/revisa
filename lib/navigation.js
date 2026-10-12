export const appRoutes = Object.freeze({
  overview: '/',
  agenda: '/agenda',
  pomodoro: '/pomodoro',
  topics: '/assuntos',
  disciplines: '/disciplinas',
  exams: '/provas',
  settings: '/intervalos',
  appearance: '/aparencia',
  profile: '/perfil',
});

const routesByPath = new Map(Object.entries(appRoutes).map(([view, path]) => [path, view]));

export function viewForPath(pathname) {
  const normalized = pathname !== '/' ? String(pathname || '').replace(/\/+$/, '') : '/';
  return routesByPath.get(normalized) || null;
}
