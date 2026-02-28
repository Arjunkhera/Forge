"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Registry = exports.ForgeCore = void 0;
// Core
var core_js_1 = require("./core.js");
Object.defineProperty(exports, "ForgeCore", { enumerable: true, get: function () { return core_js_1.ForgeCore; } });
var registry_js_1 = require("./registry/registry.js");
Object.defineProperty(exports, "Registry", { enumerable: true, get: function () { return registry_js_1.Registry; } });
// Models
__exportStar(require("./models/index.js"), exports);
// Adapters
__exportStar(require("./adapters/index.js"), exports);
// Resolver
__exportStar(require("./resolver/index.js"), exports);
// Workspace
__exportStar(require("./workspace/index.js"), exports);
// Compiler
__exportStar(require("./compiler/index.js"), exports);
// Global Config
__exportStar(require("./config/index.js"), exports);
//# sourceMappingURL=index.js.map