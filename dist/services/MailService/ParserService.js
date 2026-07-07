"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const inversify_1 = require("inversify");
const mailparser_1 = require("mailparser");
let ParserService = class ParserService {
    async parseEmail(source) {
        const parsed = (await (0, mailparser_1.simpleParser)(source));
        return parsed;
    }
    extractEmails(value) {
        if (!value)
            return [];
        if (Array.isArray(value))
            return value.flatMap((v) => this.extractEmails(v));
        if (typeof value === "string") {
            return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((v) => v.toLowerCase());
        }
        if (typeof value === "object") {
            const typedValue = value;
            if (Array.isArray(typedValue.value)) {
                return typedValue.value
                    .map((v) => v.address)
                    .filter((v) => Boolean(v))
                    .map((v) => v.toLowerCase());
            }
            if (typedValue.address)
                return [typedValue.address.toLowerCase()];
            if (typedValue.text)
                return this.extractEmails(typedValue.text);
        }
        return [];
    }
};
exports.ParserService = ParserService;
exports.ParserService = ParserService = __decorate([
    (0, inversify_1.injectable)()
], ParserService);
