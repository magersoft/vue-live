import hash from 'hash-sum';
import { compile, isCodeVueSfc, adaptCreateElement, concatenate, addScopedStyle } from 'vue-inbrowser-compiler';
import 'prismjs';
import 'prismjs/components/prism-jsx.min';
import PrismEditor from 'vue-prism-editor';
import debounce from 'debounce';

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(source, true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(source).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

/**
 * evaluate es5 code in the browser
 * and return value if there s a return statement
 * @param {String} code the body of the funtion to execute
 * @param {Function} require the fake function require
 */
function evalInContext(code, require, adaptCreateElement, concatenate) {
  // eslint-disable-next-line no-new-func
  var func = new Function("require", "__pragma__", "__concatenate__", code);
  return func(require, adaptCreateElement, concatenate);
}

/**
 * Return module from a given map (like {app: require('app')}) or throw.
 */
function requireAtRuntime(requires, filepath) {
  requires = requires || {};

  if (!(filepath in requires)) {
    throw new Error("import or require() statements can be added only by setting it using the requires prop");
  }

  return requires[filepath];
}

var script = {
  name: "VueLivePreviewComponent",
  components: {},
  props: {
    /**
     * code rendered
     */
    code: {
      type: String,
      required: true
    },

    /**
     * Hashtable of auto-registered components
     * @example { DatePicker: VueDatePicker }
     * @example { VueDatePicker }
     */
    components: {
      type: Object,
      default: function _default() {}
    },

    /**
     * Hashtable of modules available in require and import statements
     * in the code prop
     * @example { lodash: require("lodash") }
     * @example { moment: require("moment") }
     */
    requires: {
      type: Object,
      default: function _default() {}
    },
    jsx: {
      type: Boolean,
      default: false
    },

    /**
     * Outside data to the preview
     * @example { count: 1 }
     */
    dataScope: {
      type: Object,
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      scope: this.generateScope(),
      previewedComponent: undefined,
      error: false
    };
  },
  created: function created() {
    this.renderComponent(this.code.trim());
  },
  watch: {
    code: function code(value) {
      this.renderComponent(value.trim());
    }
  },
  methods: {
    /**
     * Generates the Scope Id attribute value. It will be added to each
     * tag if a style is applied to scope the style only to this example
     */
    generateScope: function generateScope() {
      return "v-xxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === "x" ? r : r & 0x3 | 0x8;
        return v.toString(16);
      });
    },
    handleError: function handleError(e) {
      this.error = e.message;
    },
    renderComponent: function renderComponent(code) {
      var _this = this;

      var data = {};
      var style;

      try {
        var renderedComponent = compile(code, this.jsx ? {
          jsx: "__pragma__(h)",
          objectAssign: "__concatenate__"
        } : {});
        style = renderedComponent.style;

        if (renderedComponent.script) {
          // if the compiled code contains a script it might be "just" a script
          // if so, change scheme used by editor
          this.$emit("detect-language", isCodeVueSfc(code) ? "vue" : "js"); // compile and execute the script
          // it can be:
          // - a script setting up variables => we set up the data property of renderedComponent
          // - a `new Vue()` script that will return a full config object

          var script = renderedComponent.script;
          data = evalInContext(script, function (filepath) {
            return requireAtRuntime(_this.requires, filepath);
          }, adaptCreateElement, concatenate) || {};

          if (this.dataScope) {
            var mergeData = _objectSpread2({}, data.data(), {}, this.dataScope);

            data.data = function () {
              return mergeData;
            };
          }
        }

        if (renderedComponent.template) {
          // if this is a pure template or if we are in hybrid vsg mode,
          // we need to set the template up.
          data.template = "<div>".concat(renderedComponent.template, "</div>");
        }
      } catch (e) {
        this.handleError(e);
        return;
      }

      data.components = this.components;

      if (style) {
        // To add the scope id attribute to each item in the html
        // this way when we add the scoped style sheet it will be aplied
        data._scopeId = "data-".concat(this.scope);
        addScopedStyle(style, this.scope);
      }

      if (data.template || data.render) {
        this.previewedComponent = data;
      } else {
        this.handleError({
          message: "[Vue Live] no template or render function specified, you might have an issue in your example"
        });
      }
    }
  }
};

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier
/* server only */
, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
  if (typeof shadowMode !== 'boolean') {
    createInjectorSSR = createInjector;
    createInjector = shadowMode;
    shadowMode = false;
  } // Vue.extend constructor export interop.


  var options = typeof script === 'function' ? script.options : script; // render functions

  if (template && template.render) {
    options.render = template.render;
    options.staticRenderFns = template.staticRenderFns;
    options._compiled = true; // functional template

    if (isFunctionalTemplate) {
      options.functional = true;
    }
  } // scopedId


  if (scopeId) {
    options._scopeId = scopeId;
  }

  var hook;

  if (moduleIdentifier) {
    // server build
    hook = function hook(context) {
      // 2.3 injection
      context = context || // cached call
      this.$vnode && this.$vnode.ssrContext || // stateful
      this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext; // functional
      // 2.2 with runInNewContext: true

      if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
        context = __VUE_SSR_CONTEXT__;
      } // inject component styles


      if (style) {
        style.call(this, createInjectorSSR(context));
      } // register component module identifier for async chunk inference


      if (context && context._registeredComponents) {
        context._registeredComponents.add(moduleIdentifier);
      }
    }; // used by ssr in case component is cached and beforeCreate
    // never gets called


    options._ssrRegister = hook;
  } else if (style) {
    hook = shadowMode ? function () {
      style.call(this, createInjectorShadow(this.$root.$options.shadowRoot));
    } : function (context) {
      style.call(this, createInjector(context));
    };
  }

  if (hook) {
    if (options.functional) {
      // register for functional component in vue file
      var originalRender = options.render;

      options.render = function renderWithStyleInjection(h, context) {
        hook.call(context);
        return originalRender(h, context);
      };
    } else {
      // inject component registration as beforeCreate hook
      var existing = options.beforeCreate;
      options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
    }
  }

  return script;
}

var normalizeComponent_1 = normalizeComponent;

/* script */
const __vue_script__ = script;

/* template */
var __vue_render__ = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c(
    "div",
    [
      _vm._t("before-preview"),
      _vm._v(" "),
      _vm.error
        ? _c("div", { staticStyle: { color: "red" } }, [
            _vm._v(_vm._s(this.error))
          ])
        : _vm._e(),
      _vm._v(" "),
      !_vm.error && _vm.previewedComponent
        ? _c(_vm.previewedComponent, {
            tag: "component",
            attrs: { id: _vm.scope }
          })
        : _vm._e(),
      _vm._v(" "),
      _vm._t("after-preview")
    ],
    2
  )
};
var __vue_staticRenderFns__ = [];
__vue_render__._withStripped = true;

  /* style */
  const __vue_inject_styles__ = undefined;
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = undefined;
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* style inject */
  
  /* style inject SSR */
  

  
  var VueLivePreview = normalizeComponent_1(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    undefined,
    undefined
  );

//
var UPDATE_DELAY = 300;
var script$1 = {
  name: 'VueLiveEditor',
  components: {
    PrismEditor: PrismEditor
  },
  props: {
    code: {
      type: String,
      required: true
    },
    delay: {
      type: Number,
      default: UPDATE_DELAY
    },
    editorProps: {
      type: Object,
      default: function _default() {
        return {};
      }
    },
    prismLang: {
      type: String,
      default: 'html'
    }
  },
  data: function data() {
    return {
      updatePreview: function updatePreview() {},

      /**
       * this data only gets changed when changing language.
       * it allows for copy and pasting without having the code
       * editor repainted every keystroke
       */
      stableCode: this.code
    };
  },
  watch: {
    code: function code(value) {
      this.updatePreview(value);
    }
  },
  created: function created() {
    var _this = this;

    this.updatePreview = debounce(function (value) {
      _this.stableCode = value;

      _this.$emit('change', value);
    }, this.delay);
  }
};

/* script */
const __vue_script__$1 = script$1;

/* template */
var __vue_render__$1 = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c(
    "div",
    [
      _vm._t("before-editor"),
      _vm._v(" "),
      _c(
        "PrismEditor",
        _vm._b(
          {
            attrs: { language: _vm.prismLang },
            on: { change: _vm.updatePreview },
            model: {
              value: _vm.stableCode,
              callback: function($$v) {
                _vm.stableCode = $$v;
              },
              expression: "stableCode"
            }
          },
          "PrismEditor",
          _vm.editorProps,
          false
        )
      ),
      _vm._v(" "),
      _vm._t("after-editor")
    ],
    2
  )
};
var __vue_staticRenderFns__$1 = [];
__vue_render__$1._withStripped = true;

  /* style */
  const __vue_inject_styles__$1 = undefined;
  /* scoped */
  const __vue_scope_id__$1 = undefined;
  /* module identifier */
  const __vue_module_identifier__$1 = undefined;
  /* functional template */
  const __vue_is_functional_template__$1 = false;
  /* style inject */
  
  /* style inject SSR */
  

  
  var VueLiveEditor = normalizeComponent_1(
    { render: __vue_render__$1, staticRenderFns: __vue_staticRenderFns__$1 },
    __vue_inject_styles__$1,
    __vue_script__$1,
    __vue_scope_id__$1,
    __vue_is_functional_template__$1,
    __vue_module_identifier__$1,
    undefined,
    undefined
  );

/* script */

/* template */
var __vue_render__$2 = function(_h, _vm) {
  var _c = _vm._c;
  return _c(
    "div",
    { staticClass: "vue-live-container", staticStyle: { display: "flex" } },
    [
      _c("div", { staticStyle: { width: "50%" } }, [_vm._t("editor")], 2),
      _vm._v(" "),
      _c(
        "div",
        { staticStyle: { "background-color": "white", width: "50%" } },
        [_vm._t("preview")],
        2
      )
    ]
  )
};
var __vue_staticRenderFns__$2 = [];
__vue_render__$2._withStripped = true;

  /* style */
  const __vue_inject_styles__$2 = undefined;
  /* scoped */
  const __vue_scope_id__$2 = undefined;
  /* module identifier */
  const __vue_module_identifier__$2 = undefined;
  /* functional template */
  const __vue_is_functional_template__$2 = true;
  /* style inject */
  
  /* style inject SSR */
  

  
  var VueLiveDefaultLayout = normalizeComponent_1(
    { render: __vue_render__$2, staticRenderFns: __vue_staticRenderFns__$2 },
    __vue_inject_styles__$2,
    {},
    __vue_scope_id__$2,
    __vue_is_functional_template__$2,
    __vue_module_identifier__$2,
    undefined,
    undefined
  );

//
var LANG_TO_PRISM = {
  vue: "html",
  js: "jsx"
};
var UPDATE_DELAY$1 = 300;
var script$2 = {
  name: "VueLivePreview",
  components: {
    Preview: VueLivePreview,
    Editor: VueLiveEditor
  },
  props: {
    /**
     * code rendered in the preview and the editor
     */
    code: {
      type: String,
      required: true
    },

    /**
     * Layout vue component with 2 slots named `editor` & `preview`
     */
    layout: {
      type: Object,
      default: undefined
    },

    /**
     * Hashtable of auto-registered components
     * @example { DatePicker: VueDatePicker }
     * @example { VueDatePicker }
     */
    components: {
      type: Object,
      default: function _default() {}
    },

    /**
     * Hashtable of modules available in require and import statements
     * in the Preview component
     * @example { lodash: require("lodash") }
     * @example { moment: require("moment") }
     */
    requires: {
      type: Object,
      default: function _default() {}
    },

    /**
     * Time in ms debouncing updates to the preview
     */
    delay: {
      type: Number,
      default: UPDATE_DELAY$1
    },

    /**
     * Do the code contain JSX rendered functions
     */
    jsx: {
      type: Boolean,
      default: false
    },

    /**
     * These props will be passed as a spreat to your layout
     * They can be used to change the style
     */
    layoutProps: {
      type: Object,
      default: undefined
    },

    /**
     * Props of vue-prism-editor
     * @example { lineNumbers: true }
     * @see https://github.com/koca/vue-prism-editor
     */
    editorProps: {
      type: Object,
      default: function _default() {
        return {};
      }
    },

    /**
     * Outside data to the preview
     * @example { count: 1 }
     */
    dataScope: {
      type: Object,
      default: function _default() {}
    }
  },
  data: function data() {
    return {
      model: this.code,
      lang: "vue",
      prismLang: "html",
      VueLiveDefaultLayout: VueLiveDefaultLayout,

      /**
       * this data only gets changed when changing language.
       * it allows for copy and pasting without having the code
       * editor repainted every keystroke
       */
      stableCode: this.code
    };
  },
  computed: {
    codeKey: function codeKey() {
      return hash(this.model);
    }
  },
  watch: {
    code: function code(newCode) {
      this.stableCode = newCode;
      this.model = newCode;
    }
  },
  methods: {
    updatePreview: function updatePreview(code) {
      this.stableCode = code;
      this.model = code;
      this.$emit('change', code);
    },
    switchLanguage: function switchLanguage(newLang) {
      this.lang = newLang;
      var newPrismLang = LANG_TO_PRISM[newLang];

      if (this.prismLang !== newPrismLang) {
        this.prismLang = newPrismLang;
        this.stableCode = this.model;
      }
    }
  }
};

/* script */
const __vue_script__$2 = script$2;

/* template */
var __vue_render__$3 = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c(
    _vm.layout ? _vm.layout : _vm.VueLiveDefaultLayout,
    _vm._b(
      {
        tag: "component",
        attrs: {
          code: _vm.stableCode,
          language: _vm.lang,
          prismLang: _vm.prismLang,
          requires: _vm.requires,
          "data-scope": _vm.dataScope,
          components: _vm.components
        },
        scopedSlots: _vm._u([
          {
            key: "editor",
            fn: function() {
              return [
                _c("Editor", {
                  attrs: {
                    code: _vm.stableCode,
                    delay: _vm.delay,
                    "prism-lang": _vm.prismLang,
                    "editor-props": _vm.editorProps
                  },
                  on: { change: _vm.updatePreview }
                })
              ]
            },
            proxy: true
          },
          {
            key: "preview",
            fn: function() {
              return [
                _c("Preview", {
                  key: _vm.codeKey,
                  attrs: {
                    code: _vm.model,
                    components: _vm.components,
                    requires: _vm.requires,
                    jsx: _vm.jsx,
                    "data-scope": _vm.dataScope
                  },
                  on: { "detect-language": _vm.switchLanguage }
                })
              ]
            },
            proxy: true
          }
        ])
      },
      "component",
      _vm.layoutProps,
      false
    )
  )
};
var __vue_staticRenderFns__$3 = [];
__vue_render__$3._withStripped = true;

  /* style */
  const __vue_inject_styles__$3 = undefined;
  /* scoped */
  const __vue_scope_id__$3 = undefined;
  /* module identifier */
  const __vue_module_identifier__$3 = undefined;
  /* functional template */
  const __vue_is_functional_template__$3 = false;
  /* style inject */
  
  /* style inject SSR */
  

  
  var VueLive = normalizeComponent_1(
    { render: __vue_render__$3, staticRenderFns: __vue_staticRenderFns__$3 },
    __vue_inject_styles__$3,
    __vue_script__$2,
    __vue_scope_id__$3,
    __vue_is_functional_template__$3,
    __vue_module_identifier__$3,
    undefined,
    undefined
  );

function install(Vue) {
  Vue.component("VueLive", VueLive);
  Vue.component("VueLivePreview", VueLivePreview);
  Vue.component("VueLiveEditor", VueLiveEditor);
} // Export the library as a plugin


var main = {
  install: install
};

export default main;
export { VueLive, VueLiveEditor, VueLivePreview };
