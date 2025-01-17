import { setupDevtoolsPlugin } from '@vue/devtools-api';
import type { App } from '@vue/devtools-api/lib/esm/api/app';
import type { DevtoolsPluginApi } from '@vue/devtools-api/lib/esm/api/api';

interface Component {
    $children: Component[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $options: any,
    $el: HTMLElement,
}

// variables which store general values
let extensionComponentCollection: Component[] = [];
let highlightedElements: HTMLElement[] = [];

const POSITION_INSPECTOR_ID = 'sw-admin-extension-position-inspector';
const HIGHLIGHT_CLASS = 'sw-devtool-element-highlight';
const CLICKABLE_CLASS = 'sw-devtool-element-clickable';

export default function setupShopwareDevtools(app: App): void {
    setupDevtoolsPlugin({
        // Options
        id: 'sw-admin-extension-plugin',
        label: 'Shopware Admin extensions plugin',
        app,
    }, (api) => {
        // Add CSS for highlighting elements
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const highlightStyle = document.createElement('style');
        highlightStyle.innerHTML = `
            .${HIGHLIGHT_CLASS} {
                position: relative;
            }

            .${HIGHLIGHT_CLASS}::before {
              content: '';
              background-color: rgba(65, 184, 131, 0.35);
              width: 100%;
              height: 100%;
              min-height: 5px;
              position: absolute;
              z-index: 99999;
            }

            .${CLICKABLE_CLASS} {
                cursor: pointer;
            }
        `;
        document.head.appendChild(highlightStyle);

        // Add new inspector for finding the extension positions
        api.addInspector({
            id: POSITION_INSPECTOR_ID,
            label: 'Shopware Extension Positions',
            icon: 'picture_in_picture_alt',
            actions: [
                {
                    icon: 'flash_off',
                    tooltip: 'Unhighlight all extension positions',
                    action: (): void => {
                        unhighlightElements();
                    },
                },
                {
                    icon: 'flash_on',
                    tooltip: 'Highlight all extension positions',
                    action: (): void => {
                        unhighlightElements();

                        extensionComponentCollection.forEach((component) => {
                            makeElementClickable(component, api);
                        });
                    },
                },
            ],
        });

        // Load all positions into the inspector tree
        api.on.getInspectorTree((payload) => {
            if (payload.inspectorId !== POSITION_INSPECTOR_ID) {
                return;
            }

            payload.rootNodes = [];
            extensionComponentCollection = [];

            // @ts-expect-error
            componentIterator(payload.app as Component, (component) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (component.$options.extensionApiDevtoolInformation) {
                    const { property, positionId } = getExtensionInformation(component);

                    // create new root node if none exists
                    const hasMatchingNode = payload.rootNodes.some(n => n.id === property);
                    if (!hasMatchingNode) {
                        payload.rootNodes.push({
                            id: property,
                            label: property,
                            children: [],
                        });
                    }

                    const rootNode = payload.rootNodes.find(n => n.id === property);

                    // @ts-expect-error
                    rootNode.children?.push({
                        id: `${property}_${positionId}`,
                        label: positionId,
                    });
                    extensionComponentCollection.push(component);
                }
            });
        });

        // Update the state of the inspector depending on the selected node
        api.on.getInspectorState((payload) => {
            unhighlightElements();

            if (payload.inspectorId !== POSITION_INSPECTOR_ID) {
                return;
            }

            const matchingComponent = extensionComponentCollection.find((component) => {
                const { nodeId } = getExtensionInformation(component);

                return nodeId === payload.nodeId;
            });

            if (!matchingComponent) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
            const devtoolInformation = matchingComponent.$options.extensionApiDevtoolInformation;

            // show information about selected node
            payload.state = {
                General: [
                    {
                        key: 'PositionId',
                        // eslint-disable-next-line max-len
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
                        value: devtoolInformation.positionId(matchingComponent),
                    },
                    {
                        key: 'Property',
                        // eslint-disable-next-line max-len
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
                        value: devtoolInformation.property,
                    },
                ],
            };

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (devtoolInformation.method) {
                payload.state.General.push({
                    key: 'Method',
                    // eslint-disable-next-line max-len
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
                    value: devtoolInformation.method,
                });
            }

            // highlight the component in browser window
            highlightElement(matchingComponent);
        });
    });
}

function componentIterator(component: Component, callbackMethod: (component: Component) => void): void {
    callbackMethod(component);

    component.$children.forEach(childComponent => {
        componentIterator(childComponent, callbackMethod);
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function highlightElement(component: Component): void {
    // Highlight new element
    component.$el.classList.add(HIGHLIGHT_CLASS);
    highlightedElements.push(component.$el);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeElementClickable(component: Component, api: DevtoolsPluginApi<any>): void {
    highlightElement(component);
    component.$el.classList.add(CLICKABLE_CLASS);
    // @ts-expect-error
    component.$el.DEVTOOL_EVENT_LISTENER = (): void => {
        const { nodeId } = getExtensionInformation(component);

        api.selectInspectorNode(POSITION_INSPECTOR_ID, nodeId);
    };

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    component.$el.addEventListener('click', component.$el.DEVTOOL_EVENT_LISTENER);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unhighlightElements():void {
    highlightedElements.forEach(highlightedElement => {
        highlightedElement.classList.remove(HIGHLIGHT_CLASS);
        highlightedElement.classList.remove(CLICKABLE_CLASS);

        // @ts-expect-error
        if (highlightedElement.DEVTOOL_EVENT_LISTENER) {
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            highlightedElement.removeEventListener('click', highlightedElement.DEVTOOL_EVENT_LISTENER);
        }
    });

    highlightedElements = [];
}

function getExtensionInformation(component: Component): {
    nodeId: string,
    positionId: string,
    property: string,
    method: string,
} {
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const devtoolInformation = component.$options.extensionApiDevtoolInformation;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const property = devtoolInformation.property as string ?? 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const method = devtoolInformation.method as string ?? 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const positionId = devtoolInformation.positionId(component) as string;

    return {
        nodeId: `${property}_${positionId}`,
        positionId,
        property,
        method,
    };
}
