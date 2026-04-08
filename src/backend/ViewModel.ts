// ViewModel.ts
// written by willuhd on Apr 8
// - The view configuration describing exactly the visual state of the UI
// - No backend logic
// - Use this for frontend !!! And use Controller.ts to control it!

export type CourseStatus = 'locked' | 'available' | 'selected' | 'bypassed';

export interface CourseViewModel {
    id: string;
    name: string;
    grade: string;
    
    // UI State
    status: CourseStatus; 
    
    // Display Strings (Backend handles the formatting)
    lockReason?: string;       // e.g., "Requires: Bio 9 Honors"
    moveUpNote?: string;       // e.g., "Requires 95%+ on Bio 9 Final"
}
