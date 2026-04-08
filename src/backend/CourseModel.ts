// CourseModel.ts
// written by willuhd on Apr 6, 2026
// - The core model used for the Common Course catalog file. 
// - The internal state used by the backend
// - Not intended to use by the frontend! Please use ViewModel

export interface CourseRules {
    pre?: string[][];
    current?: string[][];
    [key: string]: any;
}

export interface CourseNode {
    id: string;
    name?: string;
    track: string;
    description: string;
    crowdRating: number;
    crowdReview: string;
    crowdPopularity: number;
    level?: string;
    rules?: CourseRules;
    moveUp?: string; // e.g. "Midterm score 95%+ or SAT 1500+ to jump tracks"
    [key: string]: any;
}

export interface DepartmentGroup {
    [grade: string]: CourseNode[];
}

export interface CourseModel {
    catalogName: string;
    version: string;
    lastUpdated: string;
    credit: string;
    grades: string[];
    tracks: string[];
    departments: {
        biology: DepartmentGroup;
        residuals: CourseNode[];
        [key: string]: any;
    };
    [key: string]: any;
}
