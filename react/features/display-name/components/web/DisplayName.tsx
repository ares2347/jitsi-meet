/* eslint-disable lines-around-comment */
import { Theme } from '@mui/material';
import { withStyles } from '@mui/styles';
import React, { Component } from 'react';
import { WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { IState, IStore } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import {
    getParticipantById,
    getParticipantDisplayName
} from '../../../base/participants/functions';
import { updateSettings } from '../../../base/settings/actions';
import { withPixelLineHeight } from '../../../base/styles/functions.web';
// @ts-ignore
import { Tooltip } from '../../../base/tooltip';
// @ts-ignore
import { getIndicatorsTooltipPosition } from '../../../filmstrip/functions.web';
import { appendSuffix } from '../../functions';

/**
 * The type of the React {@code Component} props of {@link DisplayName}.
 */
interface Props extends WithTranslation {

    /**
     * The participant's current display name which should be shown when in
     * edit mode. Can be different from what is shown when not editing.
     */
    _configuredDisplayName: string;

    /**
     * The participant's current display name which should be shown.
     */
    _nameToDisplay: string;

    /**
     * Whether or not the display name should be editable on click.
     */
    allowEditing: boolean;

    /**
     * An object containing the CSS classes.
     */
    classes: any;

    /**
     * Invoked to update the participant's display name.
     */
    dispatch: IStore['dispatch'];

    /**
     * A string to append to the displayName, if provided.
     */
    displayNameSuffix: string;

    /**
     * The ID attribute to add to the component. Useful for global querying for
     * the component by legacy components and torture tests.
     */
    elementID: string;

    /**
     * The ID of the participant whose name is being displayed.
     */
    participantID: string;

    /**
     * The type of thumbnail.
     */
    thumbnailType: string;
}

/**
 * The type of the React {@code Component} state of {@link DisplayName}.
 */
type State = {

    /**
     * The current value of the display name in the edit field.
     */
    editDisplayNameValue: string;

    /**
     * Whether or not the component should be displaying an editable input.
     */
    isEditing: boolean;
};

const styles = (theme: Theme) => {
    return {
        displayName: {
            ...withPixelLineHeight(theme.typography.labelBold),
            color: theme.palette.text01,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        },

        editDisplayName: {
            outline: 'none',
            border: 'none',
            background: 'none',
            boxShadow: 'none',
            padding: 0,
            ...withPixelLineHeight(theme.typography.labelBold),
            color: theme.palette.text01
        }
    };
};

/**
 * React {@code Component} for displaying and editing a participant's name.
 *
 * @augments Component
 */
class DisplayName extends Component<Props, State> {
    _nameInput?: HTMLInputElement;

    static defaultProps = {
        _configuredDisplayName: ''
    };

    /**
     * Initializes a new {@code DisplayName} instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props: Props) {
        super(props);

        this.state = {
            editDisplayNameValue: '',
            isEditing: false
        };

        /**
         * The internal reference to the HTML element backing the React
         * {@code Component} input with id {@code editDisplayName}. It is
         * necessary for automatically selecting the display name input field
         * when starting to edit the display name.
         *
         * @private
         * @type {HTMLInputElement}
         */
        this._nameInput = undefined;

        // Bind event handlers so they are only bound once for every instance.
        this._onChange = this._onChange.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onStartEditing = this._onStartEditing.bind(this);
        this._onSubmit = this._onSubmit.bind(this);
        this._setNameInputRef = this._setNameInputRef.bind(this);
    }

    /**
     * Automatically selects the input field's value after starting to edit the
     * display name.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidUpdate(previousProps: Props, previousState: State) {
        if (!previousState.isEditing
            && this.state.isEditing
            && this._nameInput) {
            this._nameInput.select();
        }
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const {
            _nameToDisplay,
            allowEditing,
            displayNameSuffix,
            classes,
            elementID,
            t,
            thumbnailType
        } = this.props;

        if (allowEditing && this.state.isEditing) {
            return (
                <input
                    autoFocus = { true }
                    className = { classes.editDisplayName }
                    id = 'editDisplayName'
                    onBlur = { this._onSubmit }
                    onChange = { this._onChange }
                    onClick = { this._onClick }
                    onKeyDown = { this._onKeyDown }
                    placeholder = { t('defaultNickname') }
                    ref = { this._setNameInputRef }
                    spellCheck = { 'false' }
                    type = 'text'
                    value = { this.state.editDisplayNameValue } />
            );
        }

        return (
            <Tooltip
                content = { appendSuffix(_nameToDisplay, displayNameSuffix) }
                position = { getIndicatorsTooltipPosition(thumbnailType) }>
                <span
                    className = { `displayname ${classes.displayName}` }
                    id = { elementID }
                    onClick = { this._onStartEditing }>
                    { appendSuffix(_nameToDisplay, displayNameSuffix) }
                </span>
            </Tooltip>
        );
    }

    /**
     * Stop click event propagation.
     *
     * @param {MouseEvent} e - The click event.
     * @private
     * @returns {void}
     */
    _onClick(e: React.MouseEvent) {
        e.stopPropagation();
    }

    /**
     * Updates the internal state of the display name entered into the edit
     * field.
     *
     * @param {Object} event - DOM Event for value change.
     * @private
     * @returns {void}
     */
    _onChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            editDisplayNameValue: event.target.value
        });
    }

    /**
     * Submits the edited display name update if the enter key is pressed.
     *
     * @param {Event} event - Key down event object.
     * @private
     * @returns {void}
     */
    _onKeyDown(event: React.KeyboardEvent) {
        if (event.key === 'Enter') {
            this._onSubmit();
        }
    }

    /**
     * Updates the component to display an editable input field and sets the
     * initial value to the current display name.
     *
     * @param {MouseEvent} e - The click event.
     * @private
     * @returns {void}
     */
    _onStartEditing(e: React.MouseEvent) {
        if (this.props.allowEditing) {
            e.stopPropagation();
            this.setState({
                isEditing: true,
                editDisplayNameValue: this.props._configuredDisplayName
            });
        }
    }

    /**
     * Dispatches an action to update the display name if any change has
     * occurred after editing. Clears any temporary state used to keep track
     * of pending display name changes and exits editing mode.
     *
     * @param {Event} event - Key down event object.
     * @private
     * @returns {void}
     */
    _onSubmit() {
        const { editDisplayNameValue } = this.state;
        const { dispatch } = this.props;

        // Store display name in settings
        dispatch(updateSettings({
            displayName: editDisplayNameValue
        }));

        this.setState({
            isEditing: false,
            editDisplayNameValue: ''
        });

        this._nameInput = undefined;
    }

    /**
     * Sets the internal reference to the HTML element backing the React
     * {@code Component} input with id {@code editDisplayName}.
     *
     * @param {HTMLInputElement} element - The DOM/HTML element for this
     * {@code Component}'s input.
     * @private
     * @returns {void}
     */
    _setNameInputRef(element: HTMLInputElement) {
        this._nameInput = element;
    }
}

/**
 * Maps (parts of) the redux state to the props of this component.
 *
 * @param {Object} state - The redux store/state.
 * @param {Props} ownProps - The own props of the component.
 * @private
 * @returns {{
 *     _configuredDisplayName: string,
 *     _nameToDisplay: string
 * }}
 */
function _mapStateToProps(state: IState, ownProps: Partial<Props>) {
    const { participantID } = ownProps;
    const participant = getParticipantById(state, participantID ?? '');

    return {
        _configuredDisplayName: participant?.name,
        _nameToDisplay: getParticipantDisplayName(state, participantID ?? '')
    };
}

export default translate(connect(_mapStateToProps)(withStyles(styles)(DisplayName)));
