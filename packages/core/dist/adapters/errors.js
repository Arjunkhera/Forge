"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsupportedTargetError = exports.VersionMismatchError = exports.CircularDependencyError = exports.InvalidMetadataError = exports.ArtifactNotFoundError = exports.ForgeError = void 0;
/**
 * Base error for all Forge errors.
 */
class ForgeError extends Error {
    code;
    suggestion;
    filePath;
    constructor(code, message, suggestion, filePath) {
        super(message);
        this.code = code;
        this.suggestion = suggestion;
        this.filePath = filePath;
        this.name = 'ForgeError';
    }
}
exports.ForgeError = ForgeError;
/**
 * Thrown when an artifact cannot be found in the registry.
 */
class ArtifactNotFoundError extends ForgeError {
    constructor(type, id, registryPath) {
        super('ARTIFACT_NOT_FOUND', `Artifact '${type}:${id}' was not found in the registry`, `Run 'forge search ${id}' to find available artifacts, or check that the registry path is correct`, registryPath);
        this.name = 'ArtifactNotFoundError';
    }
}
exports.ArtifactNotFoundError = ArtifactNotFoundError;
/**
 * Thrown when metadata fails validation or cannot be parsed.
 */
class InvalidMetadataError extends ForgeError {
    constructor(filePath, detail) {
        super('INVALID_METADATA', `Invalid metadata in ${filePath}: ${detail}`, `Check that ${filePath} is valid YAML and matches the expected schema`, filePath);
        this.name = 'InvalidMetadataError';
    }
}
exports.InvalidMetadataError = InvalidMetadataError;
/**
 * Thrown when a circular dependency is detected.
 */
class CircularDependencyError extends ForgeError {
    constructor(cycle) {
        super('CIRCULAR_DEPENDENCY', `Circular dependency detected: ${cycle.join(' → ')}`, 'Remove or break the circular dependency chain in your artifact definitions');
        this.name = 'CircularDependencyError';
    }
}
exports.CircularDependencyError = CircularDependencyError;
/**
 * Thrown when a version constraint cannot be satisfied.
 */
class VersionMismatchError extends ForgeError {
    constructor(id, requested, available) {
        super('VERSION_MISMATCH', `No version of '${id}' satisfies '${requested}'. Available: ${available.join(', ')}`, `Update forge.yaml to use a compatible version range, or upgrade the artifact in the registry`);
        this.name = 'VersionMismatchError';
    }
}
exports.VersionMismatchError = VersionMismatchError;
/**
 * Thrown when a compiler target is not supported.
 */
class UnsupportedTargetError extends ForgeError {
    constructor(target) {
        super('UNSUPPORTED_TARGET', `Compiler target '${target}' is not supported`, `Supported targets: claude-code, cursor, plugin. Check forge.yaml 'target' field`);
        this.name = 'UnsupportedTargetError';
    }
}
exports.UnsupportedTargetError = UnsupportedTargetError;
//# sourceMappingURL=errors.js.map