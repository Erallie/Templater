import { App, EditorPosition, EditorRangeOrCaret, EditorTransaction, MarkdownView } from "obsidian";
import { escapeRegExp } from "Utils";

export class CursorJumper {
    private cursor_regex = new RegExp("<%\\s*tp.file.cursor\\((?<order>[0-9]{0,2})\\)\\s*%>", "g");	

    constructor(private app: App) {}

    get_editor_position_from_index(content: string, index: number): EditorPosition {
        let substr = content.substr(0, index);

        let l = 0;
        let offset = -1;
        let r = -1;
        for (; (r = substr.indexOf("\n", r+1)) !== -1 ; l++, offset=r);
        offset += 1;

        let ch = content.substr(offset, index-offset).length;

        return {line: l, ch: ch};
    }

    async jump_to_next_cursor_location() {
        let active_view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (active_view === null) {
            throw new Error("No active view, can't append templates.");
        }
        let active_file = active_view.file;
        await active_view.save();

        let content = await this.app.vault.read(active_file);

        const {new_content, positions} = this.replace_and_get_cursor_positions(content);
        if (positions) {
            await this.app.vault.modify(active_file, new_content);
            this.set_cursor_location(positions);
        }
    }

    replace_and_get_cursor_positions(content: string) {
        let cursor_matches = [];
        let match;
        while((match = this.cursor_regex.exec(content)) != null) {
            cursor_matches.push(match);
        }
        if (cursor_matches.length === 0) {
            return {};
        }

        cursor_matches.sort((m1, m2) => {
            return Number(m1.groups["order"]) - Number(m2.groups["order"]);
        });
        let match_str = cursor_matches[0][0];

        cursor_matches = cursor_matches.filter(m => {
            return m[0] === match_str;
        });

        let positions = [];
        let index_offset = 0;
        for (let match of cursor_matches) {
            let index = match.index - index_offset;
            positions.push(this.get_editor_position_from_index(content, index));

            content = content.replace(new RegExp(escapeRegExp(match[0])), "");
            index_offset += match[0].length;

            // TODO: Remove this, breaking for now waiting for the new setSelections API
            break;

            /*
            // For tp.file.cursor(), we only find one
            if (match[1] === "") {
                break;
            }
            */
        }

        return {new_content: content, positions: positions};
    }

    set_cursor_location(positions: Array<EditorPosition>) {
        let active_view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (active_view === null) {
            return;
        }

        // TODO: Remove this
        let editor = active_view.editor;
        editor.focus();
        editor.setCursor(positions[0]);

        /*
        let selections = [];
        for (let pos of positions) {
            selections.push({anchor: pos, head: pos});
        }
        editor.focus();
        editor.setSelections(selections);
        */

        /*
        // Check https://github.com/obsidianmd/obsidian-api/issues/14

        let editor = active_view.editor;
        editor.focus();

        for (let pos of positions) {
            let transaction: EditorTransaction = {
                selection: {
                    from: pos
                }
            };
            editor.transaction(transaction);
        }
        */
    }
}