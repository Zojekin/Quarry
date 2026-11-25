import { BackendError, client } from "../api/client.js";
import type { Tag } from "../api/client.js";

export async function saveWithTags(
  tags: (Pick<Tag, "name"> & { id?: string })[],
  target_type: Tag["target_type"],
  save: (ids: string[]) => Promise<unknown>,
) {
  const ids: string[] = [];
  const created: string[] = [];
  try {
    for (const tag of tags) {
      if (tag.id) {
        ids.push(tag.id);
        continue;
      }
      try {
        const { id } = await client.tags.create({ name: tag.name, target_type });
        created.push(id);
        ids.push(id);
      } catch (error) {
        if (!(error instanceof BackendError) || error.status !== 409) throw error;
        // Another editor or an earlier save attempt can create the same name.
        const existing = (await client.tags.list(target_type)).find(({ name }) => name === tag.name);
        if (!existing) throw error;
        ids.push(existing.id);
      }
    }
    await save([...new Set(ids)]);
  } catch (error) {
    // If a save committed before losing its response, its new associations protect the tags.
    await Promise.allSettled(created.map((id) => client.tags.delete(id, { unused_only: true })));
    throw error;
  }
}
