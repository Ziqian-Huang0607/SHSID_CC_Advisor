// test.ts
// written by willuhd on Apr 8
//
// A demo file to display what memory models to use and when to use them.
// This treats the frontend as a wrapper for the backend instead of
// manually processing the internal state. The backend will only publish
// the view state to the UI and the UI can call the backend via exclusively
// the controller

import { CourseSelectionController } from "./Controller";
import type { CourseViewModel } from "./ViewModel";
import type { CourseModel } from "./CourseModel";

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

async function runUITest() {
    const controller = new CourseSelectionController(mockCatalog);

    controller.connectView((viewModels: Record<string, CourseViewModel>) => {
        const targetIDs = ["BIO109E030", "BIO110E030", "BIO111E070"];
        
        const tableData = targetIDs.map(id => {
            const vm = viewModels[id];
            // FIXED: Added ? check for all vm properties
            return {
                "Course Name": vm?.name || id,
                "UI Status": vm?.status || "locked", 
                "Lock Banner": vm?.lockReason || "---",
                "Move-Up Button": vm?.moveUpNote || "---"
            };
        });

        console.table(tableData);
    });

    controller.handleTap("BIO008E030");
    controller.handleTap("BIO109E030");
    controller.handleMoveUpTap("BIO110E030");
}

runUITest();