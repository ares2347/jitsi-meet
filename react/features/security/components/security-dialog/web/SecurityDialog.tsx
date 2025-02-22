/* eslint-disable lines-around-comment */
import React, { useEffect, useState } from 'react';

import { IState } from '../../../../app/types';
// @ts-ignore
import { setPassword as setPass } from '../../../../base/conference';
import { isLocalParticipantModerator } from '../../../../base/participants/functions';
import { connect } from '../../../../base/redux/functions';
import Dialog from '../../../../base/ui/components/web/Dialog';
// @ts-ignore
import { E2EESection } from '../../../../e2ee/components';
// @ts-ignore
import { LobbySection } from '../../../../lobby';

import PasswordSection from './PasswordSection';

export interface NotifyClick {
    key: string;
    preventExecution: boolean;
}

type Props = {

    /**
     * Toolbar buttons which have their click exposed through the API.
     */
    _buttonsWithNotifyClick: Array<string | NotifyClick>;

    /**
     * Whether or not the current user can modify the current password.
     */
    _canEditPassword: boolean;

    /**
     * The JitsiConference for which to display a lock state and change the
     * password.
     */
    _conference: Object;

    /**
     * The value for how the conference is locked (or undefined if not locked)
     * as defined by room-lock constants.
     */
    _locked: string;

    /**
     * The current known password for the JitsiConference.
     */
    _password: string;

    /**
     * The number of digits to be used in the password.
     */
    _passwordNumberOfDigits?: number;

    /**
     * Indicates whether e2ee will be displayed or not.
     */
    _showE2ee: boolean;

    /**
     * Action that sets the conference password.
     */
    setPassword: Function;
};

/**
 * Component that renders the security options dialog.
 *
 * @returns {React$Element<any>}
 */
function SecurityDialog({
    _buttonsWithNotifyClick,
    _canEditPassword,
    _conference,
    _locked,
    _password,
    _passwordNumberOfDigits,
    _showE2ee,
    setPassword
}: Props) {
    const [ passwordEditEnabled, setPasswordEditEnabled ] = useState(false);

    useEffect(() => {
        if (passwordEditEnabled && _password) {
            setPasswordEditEnabled(false);
        }
    }, [ _password ]);

    return (
        <Dialog
            cancel = {{ hidden: true }}
            ok = {{ hidden: true }}
            titleKey = 'security.title'>
            <div className = 'security-dialog'>
                <LobbySection />
                <PasswordSection
                    buttonsWithNotifyClick = { _buttonsWithNotifyClick }
                    canEditPassword = { _canEditPassword }
                    conference = { _conference }
                    locked = { _locked }
                    password = { _password }
                    passwordEditEnabled = { passwordEditEnabled }
                    passwordNumberOfDigits = { _passwordNumberOfDigits }
                    setPassword = { setPassword }
                    setPasswordEditEnabled = { setPasswordEditEnabled } />
                {
                    _showE2ee ? <>
                        <div className = 'separator-line' />
                        <E2EESection />
                    </> : null
                }

            </div>
        </Dialog>
    );
}

/**
 * Maps (parts of) the Redux state to the associated props for the
 * {@code SecurityDialog} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {Props}
 */
function mapStateToProps(state: IState) {
    const {
        conference,
        e2eeSupported,
        locked,
        password
    } = state['features/base/conference'];
    const { roomPasswordNumberOfDigits, buttonsWithNotifyClick } = state['features/base/config'];

    const showE2ee = Boolean(e2eeSupported) && isLocalParticipantModerator(state);

    return {
        _buttonsWithNotifyClick: buttonsWithNotifyClick,
        _canEditPassword: isLocalParticipantModerator(state),
        _conference: conference,
        _dialIn: state['features/invite'],
        _locked: locked,
        _password: password,
        _passwordNumberOfDigits: roomPasswordNumberOfDigits,
        _showE2ee: showE2ee
    };
}

const mapDispatchToProps = { setPassword: setPass };

export default connect(mapStateToProps, mapDispatchToProps)(SecurityDialog);
