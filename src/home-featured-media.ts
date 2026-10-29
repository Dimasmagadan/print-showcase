import { HOME_FEATURED_MODEL_ID } from './home-featured';
import printer from './assets/hero/robot-cat/printer-empty-v1.png';
import workshop from './assets/hero/robot-cat/workshop-empty-v1.png';
import photo from './content/models/robot-cat/photos/02.jpg';
import door from './assets/hero/robot-cat/door-frame-detail.svg?url';

// Each prepared scene belongs to its subject. An editorial ID change must
// never insert a different model into this subject's photographic story.
const media = { 'robot-cat': { printer, workshop, photo, door } };

export function homeFeaturedMedia() {
  return media[HOME_FEATURED_MODEL_ID as keyof typeof media];
}
