import { promises as fs } from "node:fs";
import path from "node:path";

export class LastIdService {
	private filePath: string;
	constructor(baseDir: string = process.cwd()) {
		this.filePath = path.resolve(baseDir, "data", "lastId");
	}

	async read(): Promise<number | null> {
		try {
			const content = await fs.readFile(this.filePath, "utf-8");
			const parsedId = Number(content.trim());
			return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
		} catch {
			return null;
		}
	}

	async write(id: number): Promise<void> {
		await fs.mkdir(path.dirname(this.filePath), { recursive: true });
		await fs.writeFile(this.filePath, `${id}\n`, "utf-8");
	}
}
