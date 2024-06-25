import { Collapse, List } from 'antd'
import { ReactElement } from 'react'

/**
 * returns a help glossary that shows what each attribute in the json config does
 * used in both edit queue modal and create queue modal
 */
export default function QueueConfigHelp(): ReactElement {
  return (
    <Collapse bordered={false}>
      <Collapse.Panel header="What does each key mean?" key="1">
        <List size="small" bordered>
          {/* <List.Item> Not doing this for now, it's more effort than it's worth to synchronize this json with the queue name
                <strong>queue_name</strong>:{' '}
                {`The name of the queue (e.g. "Lab 1 Queue", "Lab L05 Queue", "Help Queue", etc.)`}
              </List.Item> */}
          <List.Item>
            {/* Note: All the quotes (") need to be escaped in JSX, I opted for template literals since they look the cleanest out of the options*/}
            <strong>fifo_queue_view_enabled (not implemented yet)</strong>:{' '}
            {`Whether the First In First Out queue view is enabled (standard queue view. Default = true)`}
          </List.Item>
          <List.Item>
            <strong>tag_groups_queue_view_enabled (not implemented yet)</strong>
            :{' '}
            {`Whether the tag groups queue view is enabled (a view that groups questions by their tag or task. Works more like a priority queue that allows TAs to easily prioritize certain tags or tasks, also allowing them to stay in the same headspace and mark all of the same task in a row. Default = true)`}
          </List.Item>
          <List.Item>
            <strong>default_view (not implemented yet)</strong>:{' '}
            {`The default view for the queue. Values are "fifo" or "tag_groups" (default = "fifo")`}
          </List.Item>
          <List.Item>
            <strong>minimum_tags (not implemented yet)</strong>:{' '}
            {`The minimum number of tags required for a question. Requiring at least 1 tag can be useful for grouping questions (just maybe make sure to have a "General" tag). Default = 0.`}
          </List.Item>
          <List.Item>
            <strong>tags</strong>:{' '}
            {`The tags that students can put on their questions. Each tag has a key (e.g. "tag1", "tag2", etc.) and a value that contains the display name and color of the tag`}{' '}
            <strong>{`No Spaces for the id (e.g. "tag1")`}</strong>
            Example:
            <pre>
              {' '}
              {/* <pre> tag makes code look pretty, have to append on "tags" to workaround the outer bracket given by JSON.stringify*/}
              {`"tags": ${JSON.stringify(
                {
                  tag1: {
                    display_name: 'General',
                    color_hex: '#66FF66',
                  },
                  tag2: {
                    display_name: 'Bugs',
                    color_hex: '#66AA66',
                  },
                  tag3: {
                    display_name: 'Important',
                    color_hex: '#FF0000',
                  },
                },
                null,
                2,
              )}`}
            </pre>
          </List.Item>
          <List.Item>
            <strong>assignment_id</strong>:{' '}
            {`The assignment ID for the queue (e.g. "lab1", "lab2", "assignment1", etc.). This is used to track the assignment progress for students. Needed only if tasks are specified.`}{' '}
            <strong>No spaces.</strong>
          </List.Item>
          <List.Item>
            <strong>tasks</strong>:{' '}
            {`The tasks for the queue. A task is similar to a tag except it is 'check-able'. For example, a lab may have many parts or questions that require a TA to look at before the end of the lab.`}{' '}
            <strong>{`No Spaces for the id (e.g. "task1"). `}</strong>
            Example:
            <pre>
              {`"tasks": ${JSON.stringify(
                {
                  task1: {
                    display_name: 'Task 1',
                    short_display_name: '1',
                    blocking: false,
                    color_hex: '#ffedb8',
                    precondition: null,
                  },
                  task2: {
                    display_name: 'Task 2',
                    short_display_name: '2',
                    blocking: false,
                    color_hex: '#fadf8e',
                    precondition: 'task1',
                  },
                  task3: {
                    display_name: 'Task 3',
                    short_display_name: '3',
                    blocking: true,
                    color_hex: '#f7ce52',
                    precondition: 'task2',
                  },
                },
                null,
                2,
              )}`}
            </pre>
            <List size="small" bordered>
              <List.Item>
                <strong>display_name</strong>:{' '}
                {`The name of the task (e.g. "Task 1", "Task 2", etc.)`}
              </List.Item>
              <List.Item>
                <strong>short_display_name</strong>:{' '}
                {`The short display name of the task (e.g. "1", "2", etc.) used in certain parts of the UI. Try to keep this no more than 1 or 2 characters.`}
              </List.Item>
              <List.Item>
                <strong>blocking</strong>:{' '}
                {`Whether the task is blocking (i.e. the student cannot complete the next task until this task is completed). For example, a blocking task could be a potentially dangerous chemistry experiment or circuit that requires the TA to look over before the students can continue with the lab. A non-blocking task could be a part of the lab that is just some calculations or coding, where the student can still progress forward with the lab even though they haven't had their work checked yet. A list of tasks where none are blocking essentially allows students to wait until the end of the lab to have every one of their tasks checked off. Default = false`}
              </List.Item>
              <List.Item>
                <strong>color_hex</strong>:{' '}
                {`The color of the task (in hex format, e.g. "#ffedb8"). As a suggestion, you can make each color of each task only slightly different different from each other, that way it's easier to spot tasks (e.g. a light pale yellow for task1 going to a dark brown for task8).`}
              </List.Item>
              <List.Item>
                <strong>precondition</strong>:{' '}
                {`The key of the task (e.g. "task1") that must be completed before this task can be completed. This allows you to define the order in which tasks are completed. The first task should be null (as it has no precondition). Default = null`}
              </List.Item>
            </List>
          </List.Item>
          <List.Item>
            {`Note: for now, it is recommended to store these configs someplace safe (e.g. a text document) to make it easier to copy and paste into future courses/queues.`}
          </List.Item>
          <List.Item>
            {`Note: also, for now, the editor does not warn you if you have two duplicate keys (e.g. having two "assignment_id"s or two "tag1"s). Make sure to double check your config.`}
          </List.Item>
        </List>
      </Collapse.Panel>
    </Collapse>
  )
}
