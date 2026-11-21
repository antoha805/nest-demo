import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CategoriesService } from '../categories/categories.service';

// Templates the user picks from the client's menu. They only word the request:
// the model then does the work with the tools, under the user's permissions.
@Injectable()
export class McpPrompts {
  constructor(private readonly categoriesService: CategoriesService) {}

  register(server: McpServer): void {
    server.registerPrompt(
      'draft_post',
      {
        title: 'Draft a post',
        description: 'Writes a post on a topic and saves it as a draft.',
        argsSchema: {
          topic: z.string().describe('What the post is about.'),
          category: optionalCompletable(
            z.string().describe('The name of its category.'),
            (value) => this.categoryNames(value),
          ),
        },
      },
      ({ topic, category }) =>
        userMessage(
          `Write a blog post about: ${topic}.\n\n` +
            (category
              ? `Put it in the "${category}" category. `
              : 'Pick the best fitting category. ') +
            'Use list_categories to find its id. Then save it with create_post ' +
            'as a draft, without published, and show me the title and content. ' +
            'Do not publish it.',
        ),
    );

    server.registerPrompt(
      'summarize_comments',
      {
        title: 'Summarize comments',
        description: "Summarizes what people say in a post's comments.",
        argsSchema: { postId: z.string().describe('The id of the post.') },
      },
      ({ postId }) =>
        userMessage(
          `Get post ${postId} with get_post, and all its comments with ` +
            'list_comments, following nextCursor until it is null. Then ' +
            'summarize what the commenters think: the main points, questions ' +
            'they ask, and whether they agree with the post.',
        ),
    );
  }

  // Offered as the user types the category argument.
  private async categoryNames(prefix = ''): Promise<string[]> {
    const lower = prefix.toLowerCase();
    return (await this.categoriesService.findAll())
      .map((category) => category.name)
      .filter((name) => name.toLowerCase().startsWith(lower));
  }
}

// The SDK looks for the completer inside .optional() when the prompt is
// registered, to enable completions, but on the optional itself when answering
// a completion request, so both need it.
function optionalCompletable(
  schema: z.ZodString,
  complete: (value: string) => Promise<string[]>,
) {
  return completable(completable(schema, complete).optional(), (value) =>
    complete(value ?? ''),
  );
}

function userMessage(text: string) {
  return {
    messages: [
      { role: 'user' as const, content: { type: 'text' as const, text } },
    ],
  };
}
