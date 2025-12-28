
import { db } from "./db";
import { widgetConfigurations } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function deleteWidgetsBySlugs() {
  const slugsToDelete = ["cliniquess", "cliniquesss", "cliniquessss"];
  
  console.log("Starting widget deletion process...");
  
  for (const slug of slugsToDelete) {
    console.log(`\nSearching for widget with slug: ${slug}`);
    
    // Find widget by slug
    const [widget] = await db.select().from(widgetConfigurations).where(eq(widgetConfigurations.slug, slug));
    
    if (!widget) {
      console.log(`No widget found with slug: ${slug}`);
      continue;
    }
    
    console.log(`Found widget: ${widget.id} - ${widget.slug}`);
    
    // Delete the widget
    await db.delete(widgetConfigurations).where(eq(widgetConfigurations.id, widget.id));
    console.log(`Deleted widget: ${widget.slug}`);
    
    console.log(`✅ Successfully deleted widget ${slug}`);
  }
  
  console.log("\n✨ Widget deletion process completed!");
  process.exit(0);
}

// Run the deletion
deleteWidgetsBySlugs().catch((error) => {
  console.error("Error during deletion:", error);
  process.exit(1);
});
