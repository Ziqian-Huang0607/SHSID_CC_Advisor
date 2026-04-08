// ViewModel.ts
// written by willuhd on Apr 8
// - The view configuration describing exactly the visual state of the UI
// - No backend logic
// - Use this for frontend !!! And use Controller.ts to control it!

export interface CourseViewModel {
    id: string;
    name: string;
    grade: string;
    level: string;
    
    // UI State
    status: 'locked' | 'available' | 'selected' | 'bypassed'; 
    
    // Display Strings (Backend handles the formatting)
    lockReason?: string;       // e.g., "Requires: Bio 9 Honors"
    moveUpNote?: string;       // e.g., "Requires 95%+ on Bio 9 Final"
}
