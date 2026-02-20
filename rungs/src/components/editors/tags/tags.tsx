import { useStore } from '@/store/store';
import TagRow from './tag-row';
import TagRowMap from './tag-row-map';

function Tags() {
  // In single AOI mode, always use current AOI
  const currentAOI = useStore((state) => state.aoi);

  if (!currentAOI) {
    return null;
  }

  const tagData = currentAOI.tags ?? [];

  return (
    <div className="bg-background relative h-full w-full">
      <div className="absolute inset-0 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <thead className="bg-muted sticky top-0 z-10">
            <tr className="text-foreground/80">
              <th className="w-[24%] px-3 py-1.5 text-left font-semibold">Name</th>
              <th className="w-[12%] px-3 py-1.5 text-left font-semibold">Data Type</th>
              <th className="w-[10%] px-3 py-1.5 text-left font-semibold">Usage</th>
              <th className="w-[10%] px-3 py-1.5 text-left font-semibold">Array Size</th>
              <th className="w-[16%] px-3 py-1.5 text-left font-semibold">Default Value</th>
              <th className="w-[28%] px-3 py-1.5 text-left font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {tagData.map((tag) => (
              <TagRowMap key={tag.id} tagData={tag} />
            ))}
            <TagRow />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Tags;
