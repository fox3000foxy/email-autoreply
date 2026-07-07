"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LastIdService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
class LastIdService {
    filePath;
    constructor(baseDir = process.cwd()) {
        this.filePath = node_path_1.default.resolve(baseDir, "data", "lastId");
    }
    async read() {
        try {
            const content = await node_fs_1.promises.readFile(this.filePath, "utf-8");
            const parsedId = Number(content.trim());
            return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
        }
        catch {
            return null;
        }
    }
    async write(id) {
        await node_fs_1.promises.mkdir(node_path_1.default.dirname(this.filePath), { recursive: true });
        await node_fs_1.promises.writeFile(this.filePath, `${id}\n`, "utf-8");
    }
}
exports.LastIdService = LastIdService;
