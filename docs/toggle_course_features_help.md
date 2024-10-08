# Guide to adding a course feature (that can be toggled on/off by the professor)

Current features that can be toggled for a course:
- Chatbot
- Async Question Centre
- Queues
- Ads
- Schedule on front course page
- Async centre AI answers

### Backend

- `/common/index.ts`: add the new feature in the validFeatures array and the CourseSettingsResponse type.
- `course_settings.entity.ts`: Add the new feature as a column and its default value (true/false)
- `course.controller.ts`: Add the new feature in the @Get(':id/features) endpoint in the two response bodies beside the other features.
    - sidenote: the entire endpoint exists in the controller, there is nothing for coursefeatures in the `course.service.ts` file, so no changes are necessary there.  
- `course.integration.ts`: tests for the toggle features endpoint. 
    - The PATCH test (specifically the "should return 200 if course settings are updated successfully" test) should be updated to include the new feature.
    - The GET test should be updated to include the new feature (specifically, where it expects the payloads).
    - 'should return 400 if the feature is not valid' needs to be updated
- `organization.integration.ts`: specifically the following tests will need to be updated with the new feature:
    - "should return 202 when a course is created with no course settings provided (which will use defaults)"
    - (optionally) "should return 200 when course is created" 

### Frontend
- `/api/index.ts`: no changes needed here. Can use the setCourseFeature and getCourseFeatures functions.
- `CourseFeaturesForm.tsx`: create a FeatureSwitch component for the new feature, following a similar format to the other features
- `/organization/course/add/page.tsx`: optionally, add the new feature to the form for creating a course.
- Now, you can add a call by using the `useCourseFeatures` hook and just use `courseFeatures.myNewFeature` to check if the feature is enabled or not (some examples are in the queue page.tsx).
