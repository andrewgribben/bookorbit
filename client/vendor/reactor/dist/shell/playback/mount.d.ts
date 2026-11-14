import type { ContentCore } from '../../core/content-core.js';
import type { HostChannel } from '../../host-api/channel.js';
import type { PlaybackBarHandle, PlaybackBarOptions } from './types.js';
export declare function mountPlaybackBar(shellRoot: HTMLElement, core: ContentCore, hostChannel: HostChannel, options?: PlaybackBarOptions): PlaybackBarHandle;
