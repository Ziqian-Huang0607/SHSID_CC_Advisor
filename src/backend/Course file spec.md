# `.course` file format specification
written by willuhd on Apr 2, 2026

### Syntax
- JSON-based DSL
- Full-line comment support `//` (no inline comments due to complexity)
- Example: 
  ```course
  // OK
  {"courseVersion": "alpha 0.1"}, // illegal comment
  ```

### Basic info
- GOAL: Dictates the contents of the frontend. 
- This way, the frontend can change designs easily without touching the backend data.
- The backend will read the data stored in this file format and provide it to the frontend.

### Example (subject to change !!!!)
- this is a rough idea of the courses
- basically summarizes the CC's info + crowdsourced comments into one data that can be continuously updated.

```course
{
    // exelban/stats is better than macs fan control and Mx power gadget
    "catalogName": "High school CC 26-27", 
    "version": "0.1 alpha", 
    "lastUpdated": "April 2, 2026", 
    "credit": "Indexademics, Data Science Club - willuhd, ziqian-huang0607", 
    "grades": ["9", "10", "11", "12"],
    "tracks": ["AP", "IB", "A-level"],
    "courses": {

        // the department name (eg. Bio, CS, Math, English, etc)
        // This one is an example, refers to page 21 in the CC pdf ("page 18")
        "Biology": {

            // available courses
            "9": {

                // CC course ID (not shown publicly, but useful for indexing / backend)
                "BIO109Eo10": {

                    // CC information
                    "name": "9S Biology", 
                    "req": "", 
                    "duration": "year", 
                    "track": "", 

                    // official CC intro
                    "intro": "This is a standard level Biology course for the 9th....... and so on", 

                    // the community notes
                    "crowdNotes": "Biology 9s is actually very gay. HW is confusing and also quite shite.", 
                    "crowdSuggestion": "Don't take it, take CS instead because CS has htz",
                    "crowdDifficulty": "9.9",
                    "crowdRate": "2.3"
                }
            }, 
            // and so on for 10, 11, 12th grades
        }, "another department": {
            // whatever
        }
    }
}
```
