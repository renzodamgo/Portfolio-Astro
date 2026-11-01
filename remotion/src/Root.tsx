import React from 'react';
import { Composition } from 'remotion';
import { FPS, H, W } from './theme';
import { VIDEOS } from './videos';

// One composition per chapter of the Open guide; the id is the chapter's slug.
export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <Composition key={v.slug} id={v.slug} component={v.component} durationInFrames={Math.round(v.seconds * FPS)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
