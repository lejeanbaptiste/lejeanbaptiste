import { Subject } from 'rxjs';

export interface ITimerService {
  currentAttempt: number;
  currentTick: number;
  duration: number;
  isRunning: boolean;
  maxAttempts: number;
  tick: number;

  setDuration: (value: number) => ITimerService;
  setMaxAttempt: (value: number) => ITimerService;
  start: () => ITimerService;
  stop: () => ITimerService;

  onTick: Subject<number>;
  onTimer: Subject<number>;
}

const tick: number = 1_000;

let timer: NodeJS.Timer;

let currentAttempt: number = 0;
let currentTick: number = 0;
let duration: number = 30_000;
let isRunning: boolean = false;
let maxAttempts: number = Infinity;

const setDuration = (value: number) => {
  duration = value;
  return TimerService;
};

const setMaxAttempt = (value: number) => {
  maxAttempts = value;
  return TimerService;
};

const start = () => {
  if (isRunning) return TimerService;

  timer = setInterval(() => {
    currentTick += tick;
    onTick.next(currentTick);

    if (currentTick === duration) {
      currentTick = 0;
      onTimer.next(duration);
    }
  }, tick);

  isRunning = true;
  return TimerService;
};

const onTick = new Subject<number>();
const onTimer = new Subject<number>();

// onTick.subscribe(() => {
//   console.log(currentTick)
// });

onTimer.subscribe(() => {
  if (maxAttempts !== Infinity) currentAttempt += 1;
  if (currentAttempt === maxAttempts) stop();
});

const stop = () => {
  currentAttempt = 0;
  currentTick = 0;
  duration = 30_000;
  isRunning = false;
  maxAttempts = Infinity;
  clearInterval(timer);
  return TimerService;
};

export const TimerService: ITimerService = {
  currentAttempt,
  currentTick,
  duration,
  maxAttempts,
  isRunning,
  onTick,
  onTimer,
  setDuration,
  setMaxAttempt,
  start,
  stop,
  tick,
};

export default TimerService;
