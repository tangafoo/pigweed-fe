import { error } from '@sveltejs/kit';
import { projectById } from '$lib/data/projects';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const project = /^\d+$/.test(params.id) ? projectById(Number(params.id)) : null;
	if (!project) throw error(404, 'No such project');
	return { project };
};
