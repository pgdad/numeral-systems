describe('playerState', function () {
  var PS = NumSys.playerState;
  // 3 scenes with 2, 1 and 3 steps.
  var lesson = {
    id: 'x', title: 'X',
    scenes: [
      { id: 'a', steps: [{ say: 'a0' }, { say: 'a1' }] },
      { id: 'b', steps: [{ say: 'b0' }] },
      { id: 'c', steps: [{ say: 'c0' }, { say: 'c1' }, { say: 'c2' }] }
    ]
  };

  it('next walks through every step then returns null', function () {
    var seen = [];
    var pos = { scene: 0, step: 0 };
    while (pos) { seen.push(pos.scene + '.' + pos.step); pos = PS.next(lesson, pos); }
    expect(seen).toEqual(['0.0', '0.1', '1.0', '2.0', '2.1', '2.2']);
  });

  it('prev walks back across scenes and stops at the start', function () {
    expect(PS.prev(lesson, { scene: 2, step: 0 })).toEqual({ scene: 1, step: 0 });
    expect(PS.prev(lesson, { scene: 1, step: 0 })).toEqual({ scene: 0, step: 1 });
    expect(PS.prev(lesson, { scene: 0, step: 1 })).toEqual({ scene: 0, step: 0 });
    expect(PS.prev(lesson, { scene: 0, step: 0 })).toEqual({ scene: 0, step: 0 });
  });

  it('clampPos fixes missing and out-of-range positions', function () {
    expect(PS.clampPos(lesson, undefined)).toEqual({ scene: 0, step: 0 });
    expect(PS.clampPos(lesson, { scene: 9, step: 9 })).toEqual({ scene: 2, step: 2 });
    expect(PS.clampPos(lesson, { scene: 1, step: 5 })).toEqual({ scene: 1, step: 0 });
    expect(PS.clampPos(lesson, { scene: -1, step: -3 })).toEqual({ scene: 0, step: 0 });
  });

  it('flatIndex and fromFlat are inverses', function () {
    expect(PS.totalSteps(lesson)).toBe(6);
    for (var i = 0; i < 6; i++) expect(PS.flatIndex(lesson, PS.fromFlat(lesson, i))).toBe(i);
    expect(PS.flatIndex(lesson, { scene: 2, step: 1 })).toBe(4);
    expect(PS.fromFlat(lesson, 99)).toEqual({ scene: 2, step: 2 });
  });

  it('isLast and samePos', function () {
    expect(PS.isLast(lesson, { scene: 2, step: 2 })).toBe(true);
    expect(PS.isLast(lesson, { scene: 2, step: 1 })).toBe(false);
    expect(PS.samePos({ scene: 1, step: 0 }, { scene: 1, step: 0 })).toBe(true);
    expect(PS.samePos({ scene: 1, step: 0 }, null)).toBe(false);
  });

  it('plan continues only from a clean, fully played previous step', function () {
    expect(PS.plan(null, { scene: 0, step: 0 })).toBe('rebuild');
    expect(PS.plan({ scene: 0, completedThrough: -1 }, { scene: 0, step: 0 })).toBe('continue');
    expect(PS.plan({ scene: 0, completedThrough: 0 }, { scene: 0, step: 1 })).toBe('continue');
    expect(PS.plan({ scene: 0, completedThrough: 1 }, { scene: 0, step: 1 })).toBe('rebuild'); // replay
    expect(PS.plan({ scene: 0, completedThrough: 1 }, { scene: 0, step: 0 })).toBe('rebuild'); // prev
    expect(PS.plan({ scene: 0, completedThrough: -2 }, { scene: 0, step: 1 })).toBe('rebuild'); // dirty
    expect(PS.plan({ scene: 0, completedThrough: 1 }, { scene: 1, step: 0 })).toBe('rebuild'); // new scene
  });
});

describe('demo lesson', function () {
  it('is registered, hidden, and has an interactive last scene', function () {
    var demo = NumSys.lessons.get('demo');
    expect(!!demo).toBe(true);
    expect(demo.hidden).toBe(true);
    expect(NumSys.playerState.totalSteps(demo) >= 6).toBe(true);
    expect(demo.scenes[demo.scenes.length - 1].interactive).toBe(true);
    expect(NumSys.lessons.list().indexOf(demo)).toBe(-1);
  });
});
