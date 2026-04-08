// test.ts
// written by willuhd on Apr 8
//
// A demo file to display what memory models to use and when to use them.
// This treats the frontend as a wrapper for the backend instead of
// manually processing the internal state. The backend will only publish
// the view state to the UI and the UI can call the backend via exclusively
// the controller

import { CourseSelectionController, type CourseViewModel } from "./Controller";
import type { CourseModel } from "./CourseModel";

// --- MOCK CATALOG (Backend Data) ---
const mockCatalog: CourseModel = {
    catalogName: "UI Abstraction Test Catalog",
    version: "1.0",
    lastUpdated: "Apr 5",
    credit: "willuhd",
    grades: ["9", "10", "11", "12"],
    tracks: ["school", "AP", "IB", "ASA2"],
    departments: {
        biology: {
            "9": [
                { id: "BIO109E030", name: "Bio 9 Honors", track: "school", description: "...", crowdRating: 6.7, crowdReview: "...", crowdPopularity: 6.7, level: "H", rules: { pre: [["BIO008E030"]] } }
            ],
            "10": [
                { id: "BIO110E030", name: "Bio 10 Honors", track: "school", description: "...", crowdRating: 6.7, crowdReview: "...", crowdPopularity: 6.7, level: "H", rules: { pre: [["BIO109E030"]] }, moveUp: "Score 95%+ on Bio 9 Final" }
            ],
            "11": [
                { id: "BIO111E070", name: "AP Biology", track: "AP", description: "...", crowdRating: 6.7, crowdReview: "...", crowdPopularity: 6.7, rules: { pre: [["BIO110E030"]] } }
            ]
        },
        residuals: [
            { id: "BIO008E030", name: "Bio 8 Honors", track: "school", description: "Pre-HS", crowdRating: 7, crowdReview: "Good", crowdPopularity: 8 }
        ]
    }
};

// ==========================================
// PURE FRONTEND SIMULATION (Zero Logic)
// ==========================================
async function runUITest() {
    console.log("--- 1. MOUNTING UI & CONNECTING TO CONTROLLER ---");
    const controller = new CourseSelectionController(mockCatalog);

    // The frontend subscribes to the View-Models. It just blindy renders what it gets.
    controller.connectView((viewModels: Record<string, CourseViewModel>) => {
        console.log(`\n[UI Render Engine] Screen Updated:`);
        
        const targetIDs = ["BIO109E030", "BIO110E030", "BIO111E070"];
        
        // Map the pure ViewModel data to a UI table
        const tableData = targetIDs.map(id => {
            const vm = viewModels[id];
            return {
                "Course Name": vm.name,
                "UI Status": vm.status, // 'locked' | 'available' | 'selected' | 'bypassed'
                "Lock Banner": vm.lockReason || "---",
                "Move-Up Button": vm.moveUpNote || "---"
            };
        });

        console.table(tableData);
    });

    console.log("\n--- 2. SIMULATING USER TAPS ---");

    // Scenario A: User taps the prerequisite (Bio 8) in a different menu
    console.log("\n>>> EVENT: User taps [Bio 8 Honors]");
    controller.handleTap("BIO008E030");

    // Scenario B: User taps Bio 9 to select it
    console.log("\n>>> EVENT: User taps [Bio 9 Honors]");
    controller.handleTap("BIO109E030");

    // Scenario C: User tries to tap AP Biology right now
    console.log("\n>>> EVENT: User tries to tap [AP Biology] while it's locked...");
    // The controller protects state. A tap on a locked node does nothing, so the UI won't re-render.
    controller.handleTap("BIO111E070"); 

    // Scenario D: User clicks the Move Up bypass button on Bio 10
    console.log("\n>>> EVENT: User taps the 'Move Up' bypass button on [Bio 10 Honors]");
    controller.handleMoveUpTap("BIO110E030");

    // Scenario E: User deselects Bio 9 to see if the UI updates instantly
    console.log("\n>>> EVENT: User taps [Bio 9 Honors] again to deselect it...");
    controller.handleTap("BIO109E030");
}

runUITest();

