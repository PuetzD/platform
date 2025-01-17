import template from './sw-condition-type-select.html.twig';
import './sw-condition-type-select.scss';

const { Component } = Shopware;

Component.register('sw-condition-type-select', {
    template: template,

    inject: [
        'removeNodeFromTree',
        'feature',
    ],

    props: {
        availableTypes: {
            type: Array,
            required: true,
        },

        condition: {
            type: Object,
            required: true,
        },

        hasError: {
            type: Boolean,
            required: false,
            default: false,
        },

        disabled: {
            type: Boolean,
            required: false,
            default: false,
        },

        /* @internal (flag:FEATURE_NEXT_16148) */
        availableGroups: {
            type: Array,
            required: false,
            default() {
                return [];
            },
        },
    },

    data() {
        return {
            typeSearchTerm: '',
        };
    },

    computed: {
        ucTerm() {
            return this.typeSearchTerm.toUpperCase();
        },

        /**
         * @feature-deprecated (FEATURE_NEXT_16148) tag:v6.5.0 - Function is no longer needed,
         * use translatedLabel property instead
         */
        translatedTypes() {
            return this.availableTypes.map(({ type, label }) => {
                return {
                    type,
                    label: this.$tc(label),
                };
            });
        },

        typeOptions() {
            if (!(typeof this.typeSearchTerm === 'string') || this.typeSearchTerm === '') {
                if (!this.feature.isActive('FEATURE_NEXT_16148')) {
                    return this.translatedTypes;
                }

                return this.availableTypes;
            }

            if (!this.feature.isActive('FEATURE_NEXT_16148')) {
                return this.translatedTypes.filter(({ type, label }) => {
                    const ucType = type.toUpperCase();
                    const ucLabel = label.toUpperCase();

                    return ucType.includes(this.ucTerm) || ucLabel.includes(this.ucTerm);
                });
            }

            return this.availableTypes.filter(({ type, label }) => {
                const ucType = type.toUpperCase();
                const ucLabel = label.toUpperCase();

                return ucType.includes(this.ucTerm) || ucLabel.includes(this.ucTerm);
            });
        },

        typeSelectClasses() {
            return {
                'has--error': this.hasError,
            };
        },

        arrowColor() {
            if (this.disabled) {
                return {
                    primary: '#d1d9e0',
                    secondary: '#d1d9e0',
                };
            }

            if (this.hasError) {
                return {
                    primary: '#DE294C',
                    secondary: '#ffffff',
                };
            }

            return {
                primary: '#758CA3',
                secondary: '#ffffff',
            };
        },
    },

    methods: {
        changeType(type) {
            this.condition.value = null;
            if (this.condition[this.childAssociationField] && this.condition[this.childAssociationField].length > 0) {
                this.condition[this.childAssociationField].forEach((child) => {
                    this.removeNodeFromTree(this.condition, child);
                });
            }
            this.condition.type = type;
        },
    },
});
