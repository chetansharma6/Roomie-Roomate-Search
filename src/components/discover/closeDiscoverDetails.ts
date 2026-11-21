import type { SyntheticEvent } from 'react';

export function closeDiscoverDetails(event: SyntheticEvent<HTMLDialogElement>) {
  event.preventDefault();
  const dialog = event.currentTarget;
  if (dialog.hasAttribute('data-closing')) return;

  dialog.setAttribute('data-closing', '');
  const animations = dialog.getAnimations();
  const finish = () => {
    dialog.close();
    dialog.removeAttribute('data-closing');
  };

  if (animations.length === 0) finish();
  else void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
}
