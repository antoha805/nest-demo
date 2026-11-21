import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { CategoriesService } from '../../categories/categories.service';
import { Category } from '../../categories/category.entity';
import { CreateCategoryDto } from '../../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../../categories/dto/update-category.dto';
import { DESTRUCTIVE, McpToolkit, READ_ONLY, WRITE } from '../mcp-toolkit';

const categoryId = z.uuid().describe('The id of the category.');

@Injectable()
export class CategoryTools {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly toolkit: McpToolkit,
  ) {}

  register(server: McpServer, user?: AuthenticatedUser): void {
    const { toolkit, categoriesService } = this;

    server.registerTool(
      'list_categories',
      {
        title: 'List categories',
        description:
          'Lists every category by name, with how many published posts it has.',
        annotations: READ_ONLY,
      },
      () => toolkit.run(() => categoriesService.findAll()),
    );

    server.registerTool(
      'get_category',
      {
        title: 'Get a category',
        description: 'Gets a category by its id.',
        inputSchema: { id: categoryId },
        annotations: READ_ONLY,
      },
      ({ id }) => toolkit.run(() => categoriesService.findOne(id)),
    );

    server.registerTool(
      'create_category',
      {
        title: 'Create a category',
        description: 'Creates a category. Names are unique.',
        inputSchema: {
          name: z.string().describe('Up to 100 characters.'),
          description: z.string().optional(),
        },
        annotations: WRITE,
      },
      (args) =>
        toolkit.run(async () => {
          toolkit.authorize(user, (ability) => ability.can('create', Category));
          return categoriesService.create(
            await toolkit.validate(CreateCategoryDto, args),
          );
        }),
    );

    server.registerTool(
      'update_category',
      {
        title: 'Update a category',
        description: 'Changes the fields given. A null description removes it.',
        inputSchema: {
          id: categoryId,
          name: z.string().optional().describe('Up to 100 characters.'),
          description: z.string().nullable().optional(),
        },
        annotations: WRITE,
      },
      ({ id, ...fields }) =>
        toolkit.run(async () => {
          toolkit.authorize(user, (ability) => ability.can('update', Category));
          return categoriesService.update(
            id,
            await toolkit.validate(UpdateCategoryDto, fields),
          );
        }),
    );

    server.registerTool(
      'delete_category',
      {
        title: 'Delete a category',
        description:
          'Deletes a category. Fails while it still has posts, drafts included.',
        inputSchema: { id: categoryId },
        annotations: DESTRUCTIVE,
      },
      ({ id }) =>
        toolkit.run(async () => {
          toolkit.authorize(user, (ability) => ability.can('delete', Category));
          await categoriesService.remove(id);
        }, 'Category deleted'),
    );
  }
}
