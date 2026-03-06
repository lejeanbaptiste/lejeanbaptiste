import { Link, Stack } from '@mui/material';
import type { TocEntry } from '@stefanprobst/rehype-extract-toc';

export function Item({ heading }: { heading: TocEntry }) {
  return (
    <Stack component="li">
      <Link
        mb={0.5}
        onClick={() =>
          heading.id && document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
        }
        sx={{ cursor: 'pointer' }}
        underline="hover"
        variant="body2"
      >
        {heading.value}
      </Link>
      {heading.children && heading.children.length > 0 && (
        <Stack component="ul" my={0} pl={(heading.depth - 1) * 2.5}>
          {heading.children.map((subheading) => (
            <Item key={subheading.id} heading={subheading} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
