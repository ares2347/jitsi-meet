/* eslint-disable lines-around-comment */
// @ts-ignore
import { AUDIO_ONLY_SCREEN_SHARE_NO_TRACK } from '../../../../modules/UI/UIErrors';
import { IState, IStore } from '../../app/types';
import { showModeratedNotification } from '../../av-moderation/actions';
import { shouldShowModeratedNotification } from '../../av-moderation/functions';
import { setNoiseSuppressionEnabled } from '../../noise-suppression/actions';
import { showNotification } from '../../notifications/actions';
import { NOTIFICATION_TIMEOUT_TYPE } from '../../notifications/constants';
import { isModerationNotificationDisplayed } from '../../notifications/functions';
// @ts-ignore
import { stopReceiver } from '../../remote-control/actions';
// @ts-ignore
import { setScreenAudioShareState, setScreenshareAudioTrack } from '../../screen-share/actions';
import { isAudioOnlySharing, isScreenVideoShared } from '../../screen-share/functions';
// @ts-ignore
import { isScreenshotCaptureEnabled, toggleScreenshotCaptureSummary } from '../../screenshot-capture';
// @ts-ignore
import { AudioMixerEffect } from '../../stream-effects/audio-mixer/AudioMixerEffect';
import { setAudioOnly } from '../audio-only/actions';
import { getCurrentConference } from '../conference/functions';
import { getMultipleVideoSendingSupportFeatureFlag } from '../config/functions.any';
import { JitsiTrackErrors, JitsiTrackEvents } from '../lib-jitsi-meet';
import { setScreenshareMuted } from '../media/actions';
import { MEDIA_TYPE, VIDEO_TYPE } from '../media/constants';
/* eslint-enable lines-around-comment */

import {
    addLocalTrack,
    replaceLocalTrack
} from './actions.any';
import {
    createLocalTracksF,
    getLocalDesktopTrack,
    getLocalJitsiAudioTrack
} from './functions';
import { ShareOptions, ToggleScreenSharingOptions } from './types';

export * from './actions.any';

declare const APP: any;

/**
 * Signals that the local participant is ending screensharing or beginning the screensharing flow.
 *
 * @param {boolean} enabled - The state to toggle screen sharing to.
 * @param {boolean} audioOnly - Only share system audio.
 * @param {boolean} ignoreDidHaveVideo - Whether or not to ignore if video was on when sharing started.
 * @param {Object} shareOptions - The options to be passed for capturing screenshare.
 * @returns {Function}
 */
export function toggleScreensharing(
        enabled?: boolean,
        audioOnly = false,
        ignoreDidHaveVideo = false,
        shareOptions: ShareOptions = {}) {
    return (dispatch: IStore['dispatch'], getState: IStore['getState']) => {
        // check for A/V Moderation when trying to start screen sharing
        if ((enabled || enabled === undefined)
            && shouldShowModeratedNotification(MEDIA_TYPE.VIDEO, getState())) {
            if (!isModerationNotificationDisplayed(MEDIA_TYPE.PRESENTER, getState())) {
                dispatch(showModeratedNotification(MEDIA_TYPE.PRESENTER));
            }

            return Promise.reject();
        }

        if (getMultipleVideoSendingSupportFeatureFlag(getState())) {
            return _toggleScreenSharing({
                enabled,
                audioOnly,
                shareOptions
            }, {
                dispatch,
                getState
            });
        }

        return APP.conference.toggleScreenSharing(enabled, {
            audioOnly,
            desktopStream: shareOptions?.desktopStream
        }, ignoreDidHaveVideo);
    };
}

/**
 * Displays a UI notification for screensharing failure based on the error passed.
 *
 * @private
 * @param {Object} error - The error.
 * @param {Object} store - The redux store.
 * @returns {void}
 */
function _handleScreensharingError(
        error: Error | AUDIO_ONLY_SCREEN_SHARE_NO_TRACK,
        { dispatch }: IStore): void {
    if (error.name === JitsiTrackErrors.SCREENSHARING_USER_CANCELED) {
        return;
    }
    let descriptionKey, titleKey;

    if (error.name === JitsiTrackErrors.PERMISSION_DENIED) {
        descriptionKey = 'dialog.screenSharingPermissionDeniedError';
        titleKey = 'dialog.screenSharingFailedTitle';
    } else if (error.name === JitsiTrackErrors.CONSTRAINT_FAILED) {
        descriptionKey = 'dialog.cameraConstraintFailedError';
        titleKey = 'deviceError.cameraError';
    } else if (error.name === JitsiTrackErrors.SCREENSHARING_GENERIC_ERROR) {
        descriptionKey = 'dialog.screenSharingFailed';
        titleKey = 'dialog.screenSharingFailedTitle';
    } else if (error === AUDIO_ONLY_SCREEN_SHARE_NO_TRACK) {
        descriptionKey = 'notify.screenShareNoAudio';
        titleKey = 'notify.screenShareNoAudioTitle';
    }

    dispatch(showNotification({
        titleKey,
        descriptionKey
    }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
}


/**
 * Applies the AudioMixer effect on the local audio track if applicable. If there is no local audio track, the desktop
 * audio track is added to the conference.
 *
 * @private
 * @param {JitsiLocalTrack} desktopAudioTrack - The audio track to be added to the conference.
 * @param {*} state - The redux state.
 * @returns {void}
 */
async function _maybeApplyAudioMixerEffect(desktopAudioTrack: any, state: IState): Promise<void> {
    const localAudio = getLocalJitsiAudioTrack(state);
    const conference = getCurrentConference(state);

    if (localAudio) {
        // If there is a localAudio stream, mix in the desktop audio stream captured by the screen sharing API.
        const mixerEffect = new AudioMixerEffect(desktopAudioTrack);

        await localAudio.setEffect(mixerEffect);
    } else {
        // If no local stream is present ( i.e. no input audio devices) we use the screen share audio
        // stream as we would use a regular stream.
        await conference.replaceTrack(null, desktopAudioTrack);
    }
}


/**
 * Toggles screen sharing.
 *
 * @private
 * @param {boolean} enabled - The state to toggle screen sharing to.
 * @param {Store} store - The redux store.
 * @returns {void}
 */
async function _toggleScreenSharing(
        {
            enabled,
            audioOnly = false,
            shareOptions = {}
        }: ToggleScreenSharingOptions,
        store: IStore
): Promise<void> {
    const { dispatch, getState } = store;
    const state = getState();
    const audioOnlySharing = isAudioOnlySharing(state);
    const screenSharing = isScreenVideoShared(state);
    const conference = getCurrentConference(state);
    const localAudio = getLocalJitsiAudioTrack(state);
    const localScreenshare = getLocalDesktopTrack(state['features/base/tracks']);

    // Toggle screenshare or audio-only share if the new state is not passed. Happens in the following two cases.
    // 1. ShareAudioDialog passes undefined when the user hits continue in the share audio demo modal.
    // 2. Toggle screenshare called from the external API.
    const enable = audioOnly
        ? enabled ?? !audioOnlySharing
        : enabled ?? !screenSharing;
    const screensharingDetails: { sourceType?: string; } = {};

    if (enable) {
        let tracks;

        // Spot proxy stream.
        if (shareOptions.desktopStream) {
            tracks = [ shareOptions.desktopStream ];
        } else {
            const { _desktopSharingSourceDevice } = state['features/base/config'];

            if (!shareOptions.desktopSharingSources && _desktopSharingSourceDevice) {
                shareOptions.desktopSharingSourceDevice = _desktopSharingSourceDevice;
            }

            const options = {
                devices: [ VIDEO_TYPE.DESKTOP ],
                ...shareOptions
            };

            try {
                tracks = await createLocalTracksF(options) as any[];
            } catch (error) {
                _handleScreensharingError(error as any, store);

                throw error;
            }
        }

        const desktopAudioTrack = tracks.find(track => track.getType() === MEDIA_TYPE.AUDIO);
        const desktopVideoTrack = tracks.find(track => track.getType() === MEDIA_TYPE.VIDEO);

        if (audioOnly) {
            // Dispose the desktop track for audio-only screensharing.
            desktopVideoTrack.dispose();

            if (!desktopAudioTrack) {
                _handleScreensharingError(AUDIO_ONLY_SCREEN_SHARE_NO_TRACK, store);

                throw new Error(AUDIO_ONLY_SCREEN_SHARE_NO_TRACK);
            }
        } else if (desktopVideoTrack) {
            if (localScreenshare) {
                await dispatch(replaceLocalTrack(localScreenshare.jitsiTrack, desktopVideoTrack, conference));
            } else {
                await dispatch(addLocalTrack(desktopVideoTrack));
            }
            if (isScreenshotCaptureEnabled(state, false, true)) {
                dispatch(toggleScreenshotCaptureSummary(true));
            }
            screensharingDetails.sourceType = desktopVideoTrack.sourceType;
        }

        // Apply the AudioMixer effect if there is a local audio track, add the desktop track to the conference
        // otherwise without unmuting the microphone.
        if (desktopAudioTrack) {
            // Noise suppression doesn't work with desktop audio because we can't chain track effects yet, disable it
            // first. We need to to wait for the effect to clear first or it might interfere with the audio mixer.
            await dispatch(setNoiseSuppressionEnabled(false));
            _maybeApplyAudioMixerEffect(desktopAudioTrack, state);
            dispatch(setScreenshareAudioTrack(desktopAudioTrack));

            // Handle the case where screen share was stopped from the browsers 'screen share in progress' window.
            if (audioOnly) {
                desktopAudioTrack?.on(
                    JitsiTrackEvents.LOCAL_TRACK_STOPPED,
                    () => dispatch(toggleScreensharing(undefined, true)));
            }
        }

        // Disable audio-only or best performance mode if the user starts screensharing. This doesn't apply to
        // audio-only screensharing.
        const { enabled: bestPerformanceMode } = state['features/base/audio-only'];

        if (bestPerformanceMode && !audioOnly) {
            dispatch(setAudioOnly(false));
        }
    } else {
        const { desktopAudioTrack } = state['features/screen-share'];

        dispatch(stopReceiver());

        dispatch(toggleScreenshotCaptureSummary(false));

        // Mute the desktop track instead of removing it from the conference since we don't want the client to signal
        // a source-remove to the remote peer for the screenshare track. Later when screenshare is enabled again, the
        // same sender will be re-used without the need for signaling a new ssrc through source-add.
        dispatch(setScreenshareMuted(true));
        if (desktopAudioTrack) {
            if (localAudio) {
                localAudio.setEffect(undefined);
            } else {
                await conference.replaceTrack(desktopAudioTrack, null);
            }
            desktopAudioTrack.dispose();
            dispatch(setScreenshareAudioTrack(null));
        }
    }

    if (audioOnly) {
        dispatch(setScreenAudioShareState(enable));
    } else {
        // Notify the external API.
        APP.API.notifyScreenSharingStatusChanged(enable, screensharingDetails);
    }
}
