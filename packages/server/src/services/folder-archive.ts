import { strFromU8 } from 'fflate';
import { z } from 'zod';
import { IdSchema, TagColorSchema, type ContentDocument } from '@quarry/shared';

const folder = z.object({ id: IdSchema, parent_id: IdSchema.nullable(), name: z.string().trim().min(1) });
const owner = z.object({ id: IdSchema, folder_id: IdSchema, name: z.string().trim().min(1) });
const paper = owner.extend({ follow_source: z.literal([0, 1]).default(0) });
const sourceLink = z.strictObject({
  paper_id: IdSchema, item_id: IdSchema, source_question_id: IdSchema, source_version: z.number().int().positive(),
});
const treeSchema = z.strictObject({
  version: z.literal(1), entity: z.literal('folder'), root_id: IdSchema,
  folders: z.array(folder).min(1), banks: z.array(owner), papers: z.array(paper),
  source_links: z.array(sourceLink).default([]),
  tags: z.array(z.object({ id: IdSchema, name: z.string().min(1), target_type: z.literal('file'), color: TagColorSchema })),
  tag_relations: z.array(z.object({ tag_id: IdSchema, target_type: z.literal('file'), target_id: IdSchema })),
});
const manifestSchema = z.strictObject({ format: z.literal('quarry-folder'), version: z.literal(1),
  checksums: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)) });

export function readFolderArchive(files: Record<string, Uint8Array>, hash: (bytes: Uint8Array) => string,
  readDocument: (bytes: Uint8Array) => ContentDocument) {
  const manifest = manifestSchema.parse(JSON.parse(strFromU8(files['manifest.json']!)));
  const paths = Object.keys(files).filter(path => path !== 'manifest.json');
  if (Object.keys(manifest.checksums).length !== paths.length ||
    paths.some(path => manifest.checksums[path] !== hash(files[path]!))) {
    throw new Error('Folder archive checksum mismatch');
  }
  const tree = treeSchema.parse(JSON.parse(strFromU8(files['content.json']!)));
  const root = tree.folders.find(entry => entry.id === tree.root_id);
  if (!root || root.parent_id !== null) throw new Error('Invalid root folder');

  // Order parents before children and reject disconnected folders, cycles, and duplicate IDs.
  const ordered = [root];
  const folderIds = new Set([root.id]);
  const remaining = tree.folders.filter(entry => entry !== root);
  while (remaining.length) {
    const index = remaining.findIndex(entry => entry.parent_id && folderIds.has(entry.parent_id));
    if (index === -1) throw new Error('Invalid folder hierarchy');
    const entry = remaining.splice(index, 1)[0]!;
    if (folderIds.has(entry.id)) throw new Error('Duplicate folder ID');
    folderIds.add(entry.id);
    ordered.push(entry);
  }

  const targets = new Set(folderIds);
  const contents = [];
  for (const [entity, owners] of [['bank', tree.banks], ['paper', tree.papers]] as const) {
    for (const entry of owners) {
      if (targets.has(entry.id) || !folderIds.has(entry.folder_id)) throw new Error('Invalid bank or paper placement');
      targets.add(entry.id);
      const data = files['contents/' + entry.id + '.json'];
      if (!data) throw new Error('Missing bank or paper content: ' + entry.id);
      const document = readDocument(data);
      if (document.entity !== entity || document.name !== entry.name) throw new Error('Content does not match the folder index');
      contents.push({ owner: entry, document });
    }
  }
  const tagIds = new Set(tree.tags.map(tag => tag.id));
  if (tagIds.size !== tree.tags.length) throw new Error('Duplicate file tag ID');
  const relations = new Set<string>();
  for (const relation of tree.tag_relations) {
    const key = relation.tag_id + '/' + relation.target_id;
    if (!tagIds.has(relation.tag_id) || !targets.has(relation.target_id) || relations.has(key))
      throw new Error('Invalid file tag relation');
    relations.add(key);
  }
  const bankQuestions = new Set(contents.filter(entry => entry.document.entity === 'bank')
    .flatMap(entry => entry.document.questions.map(question => question.id)));
  const paperItems = new Map(contents.filter(entry => entry.document.entity === 'paper').map(entry => [
    entry.owner.id, new Set(entry.document.paper?.sections.flatMap(section => section.items.map(item => item.id))),
  ]));
  const linkedItems = new Set<string>();
  for (const link of tree.source_links) {
    const key = link.paper_id + '/' + link.item_id;
    if (linkedItems.has(key) || !bankQuestions.has(link.source_question_id) || !paperItems.get(link.paper_id)?.has(link.item_id))
      throw new Error('Invalid paper source link');
    linkedItems.add(key);
  }
  const attachments = new Map<string, string>();
  let questions = 0;
  for (const { document } of contents) {
    questions += document.questions.length;
    for (const attachment of document.attachments) {
      const existing = attachments.get(attachment.id);
      if (existing && existing !== attachment.sha256) throw new Error('Conflicting attachment identities');
      attachments.set(attachment.id, attachment.sha256);
    }
  }
  return {
    folders: ordered, contents, tags: tree.tags, relations: tree.tag_relations,
    papers: tree.papers, sourceLinks: tree.source_links,
    preview: {
      entity: 'folder' as const, name: root.name,
      summary: { folders: ordered.length, banks: tree.banks.length, papers: tree.papers.length,
        questions, attachments: new Set(attachments.values()).size },
    },
  };
}
