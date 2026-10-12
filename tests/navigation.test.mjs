import test from 'node:test';
import assert from 'node:assert/strict';
import { appRoutes, viewForPath } from '../lib/navigation.js';

test('cada área principal possui uma URL própria e única', () => {
  assert.deepEqual(appRoutes, {
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
  assert.equal(new Set(Object.values(appRoutes)).size, Object.keys(appRoutes).length);
  for (const [view, path] of Object.entries(appRoutes)) assert.equal(viewForPath(path), view);
  assert.equal(viewForPath('/disciplinas/'), 'disciplines');
  assert.equal(viewForPath('/rota-inexistente'), null);
});
