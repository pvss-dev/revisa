import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, offsets, validTopic, dateString, validReviewOffsets } from '../lib/validation.js';

test('revisões usam a data das primeiras questões, inclusive na virada do ano', () => {
  assert.deepEqual(offsets.map(days => addDays('2026-12-20', days)), [
    '2026-12-20', '2026-12-27', '2027-01-10', '2027-02-18', '2027-03-30',
  ]);
});

test('datas e dados do assunto rejeitam valores inválidos', () => {
  assert.equal(dateString('2026-02-30'), null);
  assert.equal(validTopic({ subject: 'Direito', title: 'Princípios', practiceDate: '2026-03-10', priority: 'Alta' })?.priority, 'Alta');
  assert.equal(validTopic({ subject: 'Direito', title: 'Princípios', practiceDate: '2026-02-30', priority: 'Alta' }), null);
});

test('intervalos personalizados aceitam de quatro a vinte dias crescentes', () => {
  assert.deepEqual(validReviewOffsets(['3','10','30','90']), [3,10,30,90]);
  assert.deepEqual(validReviewOffsets(['3','10','30','90','180','365']), [3,10,30,90,180,365]);
  assert.equal(validReviewOffsets([3,10,10,90]), null);
  assert.equal(validReviewOffsets([3,10,30]), null);
  assert.equal(validReviewOffsets(Array.from({length:21}, (_,i) => i+1)), null);
  assert.equal(validReviewOffsets([true,10,30,90]), null);
  assert.deepEqual(validTopic({ subject:'Direito',title:'Princípios',practiceDate:'2026-03-10',reviewOffsets:[3,10,30,90] })?.reviewOffsets, [3,10,30,90]);
  assert.equal(validTopic({ subject:'Direito',title:'Princípios',practiceDate:'2026-03-10',reviewOffsets:[10,3,30,90] }), null);
});
