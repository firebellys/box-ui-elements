/**
 * @flow
 * @file Metadata sidebar component
 * @author Box
 */

import * as React from 'react';
import { FormattedMessage } from 'react-intl';
import Instances from 'box-react-ui/lib/features/metadata-instance-editor/Instances';
import EmptyContent from 'box-react-ui/lib/features/metadata-instance-editor/EmptyContent';
import TemplateDropdown from 'box-react-ui/lib/features/metadata-instance-editor/TemplateDropdown';
import LoadingIndicator from 'box-react-ui/lib/components/loading-indicator/LoadingIndicator';
import LoadingIndicatorWrapper from 'box-react-ui/lib/components/loading-indicator/LoadingIndicatorWrapper';
import InlineError from 'box-react-ui/lib/components/inline-error/InlineError';
import messages from '../messages';
import SidebarContent from './SidebarContent';
import { withAPIContext } from '../APIContext';
import { withErrorBoundary } from '../ErrorBoundary';
import API from '../../api';
import './MetadataSidebar.scss';

type ExternalProps = {
    isFeatureEnabled?: boolean,
    getMetadata?: Function,
};

type PropsWithoutContext = {
    file: BoxItem,
} & ExternalProps;

type Props = {
    api: API,
} & PropsWithoutContext;

type State = {
    editors?: Array<MetadataEditor>,
    templates?: Array<MetadataEditorTemplate>,
    isLoading: boolean,
    hasError: boolean,
};

class MetadataSidebar extends React.PureComponent<Props, State> {
    state = {
        isLoading: false,
        hasError: false,
    };

    componentDidMount() {
        this.getMetadataEditors();
    }

    /**
     * Sets the error state to true
     *
     * @return {void}
     */
    errorCallback = (): void => {
        this.setState({ isLoading: false, hasError: true });
    };

    /**
     * Fetches the metadata editors
     *
     * @return {void}
     */
    getMetadataEditors = (): void => {
        const { api, file, getMetadata, isFeatureEnabled = true }: Props = this.props;

        api.getMetadataAPI(true).getEditors(
            file,
            ({ editors, templates }: { editors: Array<MetadataEditor>, templates: Array<MetadataEditorTemplate> }) => {
                this.setState({
                    templates,
                    editors: editors.slice(0),
                    isLoading: false,
                    hasError: false,
                });
            },
            this.errorCallback,
            getMetadata,
            isFeatureEnabled,
        );
    };

    /**
     * Checks upload permission
     *
     * @return {boolean} - true if metadata can be edited
     */
    canEdit(): boolean {
        const { file }: Props = this.props;
        const { permissions = {} }: BoxItem = file;
        const { can_upload }: BoxItemPermission = permissions;
        return !!can_upload;
    }

    /**
     * Editor we are changing
     *
     * @param {number} id - instance id
     * @return {Object} editor instance
     */
    getEditor(id: string): ?MetadataEditor {
        const { editors = [] }: State = this.state;
        return editors.find(({ instance }) => instance.id === id);
    }

    /**
     * Instance remove success handler
     *
     * @param {Object} editor - the editor to remove
     * @return {void}
     */
    onRemoveSuccessHandler(editor: MetadataEditor): void {
        const { editors = [] }: State = this.state;
        const clone = editors.slice(0);
        clone.splice(editors.indexOf(editor), 1);
        this.setState({ editors: clone });
    }

    /**
     * Instance remove handler
     *
     * @param {number} id - instance id
     * @return {void}
     */
    onRemove = (id: string): void => {
        const { api, file }: Props = this.props;
        const editor = this.getEditor(id);
        if (!editor) {
            return;
        }

        api.getMetadataAPI(false).deleteMetadata(
            file,
            editor.template,
            () => this.onRemoveSuccessHandler(editor),
            this.errorCallback,
        );
    };

    /**
     * Instance add success handler
     *
     * @param {number} id - instance id
     * @return {void}
     */
    onAddSuccessHandler = (editor: MetadataEditor): void => {
        const { editors = [] }: State = this.state;
        const clone = editors.slice(0);
        clone.push(editor);
        this.setState({ editors: clone, isLoading: false });
    };

    /**
     * Instance add handler
     *
     * @param {Object} template - instance template
     * @return {void}
     */
    onAdd = (template: MetadataEditorTemplate) => {
        const { api, file }: Props = this.props;
        this.setState({ isLoading: true });
        api.getMetadataAPI(false).createMetadata(file, template, this.onAddSuccessHandler, this.errorCallback);
    };

    /**
     * Instance save success handler
     *
     * @param {Object} oldEditor - prior editor
     * @param {Object} newEditor - updated editor
     * @return {void}
     */
    onSaveSuccessHandler(oldEditor: MetadataEditor, newEditor: MetadataEditor): void {
        const { editors = [] }: State = this.state;
        const clone = editors.slice(0);
        clone.splice(editors.indexOf(oldEditor), 1, newEditor);
        this.setState({ editors: clone });
    }

    /**
     * Instance save handler
     *
     * @param {number} id - instance id
     * @param {Array} ops - json patch ops
     * @return {void}
     */
    onSave = (id: string, ops: JsonPatchData): void => {
        const { api, file }: Props = this.props;
        const oldEditor = this.getEditor(id);
        if (!oldEditor) {
            return;
        }

        api.getMetadataAPI(false).updateMetadata(
            file,
            oldEditor.template,
            ops,
            (newEditor: MetadataEditor) => {
                this.onSaveSuccessHandler(oldEditor, newEditor);
            },
            this.errorCallback,
        );
    };

    /**
     * Instance dirty handler
     *
     * @param {number} id - instance id
     * @param {boolean} isDirty - instance dirty state
     * @return {void}
     */
    onModification = (id: string, isDirty: boolean) => {
        const { editors = [] }: State = this.state;
        const index = editors.findIndex(({ instance }) => instance.id === id);
        if (index === -1) {
            return;
        }

        const editor = { ...editors[index] };
        editor.isDirty = isDirty;
        const clone = editors.slice(0);
        clone.splice(index, 1, editor);
        this.setState({ editors: clone });
    };

    render() {
        const { editors, templates, isLoading, hasError }: State = this.state;
        const showEditor = !!templates && !!editors;
        const showLoadingIndicator = !hasError && !showEditor;
        const canEdit = this.canEdit();
        const showTemplateDropdown = showEditor && canEdit;
        const showEmptyContent = showEditor && ((editors: any): Array<MetadataEditor>).length === 0;

        return (
            <SidebarContent
                title={<FormattedMessage {...messages.sidebarMetadataTitle} />}
                actions={
                    showTemplateDropdown ? (
                        <TemplateDropdown
                            hasTemplates={templates && templates.length !== 0}
                            isDropdownBusy={false}
                            onAdd={this.onAdd}
                            templates={templates}
                            usedTemplates={editors && editors.map(editor => editor.template)}
                        />
                    ) : null
                }
            >
                {hasError && (
                    <InlineError title={<FormattedMessage {...messages.sidebarMetadataErrorTitle} />}>
                        <FormattedMessage {...messages.sidebarMetadataErrorContent} />
                    </InlineError>
                )}
                {showLoadingIndicator && <LoadingIndicator />}
                {showEditor && (
                    <LoadingIndicatorWrapper className="metadata-instance-editor" isLoading={isLoading}>
                        {showEmptyContent ? (
                            <EmptyContent canAdd={canEdit} />
                        ) : (
                            <Instances
                                editors={editors}
                                onModification={this.onModification}
                                onSave={this.onSave}
                                onRemove={this.onRemove}
                            />
                        )}
                    </LoadingIndicatorWrapper>
                )}
            </SidebarContent>
        );
    }
}

export type MetadataSidebarProps = ExternalProps;
export { MetadataSidebar as MetadataSidebarComponent };
export default withErrorBoundary(withAPIContext(MetadataSidebar));
