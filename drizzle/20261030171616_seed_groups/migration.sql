-- The fixed set of groups users can join. Users can't create groups, so new ones are added here.
INSERT INTO `groups` (`id`, `name`, `created_at`) VALUES
	('dev', 'Dev group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('ui-ux', 'UI/UX group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('product', 'Product group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('qa', 'QA group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('devops', 'DevOps group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	('marketing', 'Marketing group', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT (`id`) DO NOTHING;
