import math

def Linked_List__Private__Clear_Node(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   node: Linked List: Node
    # VAR_TEMP:
    #   ret: Linked List: Node
    context['ret'].meta.key = context['NULL_TOKEN']
    context['ret'].meta.next = context['NULL_TOKEN']
    context['node'] = context['ret']


def Linked_List__Private__Get_Head(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Linked List: Node
    # VAR_INPUT:
    #   list: Linked List: List
    # VAR_TEMP:
    #   pointer_list: DInt
    #   ret: Linked List: Node
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if context['list'].me[int(context['pointer_list'])].meta.is_head:
            context['ret'] = context['list'].me[int(context['pointer_list'])]
            break
    context['Linked List: Private: Get Head'] = context['ret']


def Linked_List__Private__Before(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   next_node: Linked List: Node
    #   node: Linked List: Node
    context['node'].meta.next = context['next_node'].meta.key
    if context['next_node'].meta.is_head:
        context['next_node'].meta.is_head = False
        context['node'].meta.is_head = True


def Linked_List__Private__Tail_Swap(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   new_tail: Linked List: Node
    #   old_tail: Linked List: Node
    context['new_tail'].meta.is_tail = True
    context['old_tail'].meta.is_tail = False


def Linked_List__Private__Head_Swap(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   new_head: Linked List: Node
    #   old_head: Linked List: Node
    context['new_head'].meta.is_head = True
    context['old_head'].meta.is_head = False


def Linked_List__Private__Get_Next(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Linked List: Node
    # VAR_INPUT:
    #   current: Linked List: Node
    #   list: Linked List: List
    # VAR_TEMP:
    #   ret: Linked List: Node
    Linked_List__Private__Clear_Node(context['ret'])
    if (context['list'].me[int(context['current'].meta.key)].meta.next != context['NULL_TOKEN']):
        context['ret'] = context['list'].me[int(context['current'].meta.next)]
    context['Linked List: Private: Get Next'] = context['ret']


def Linked_List__Private__Get_Previous(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Linked List: Node
    # VAR_INPUT:
    #   current: Linked List: Node
    #   list: Linked List: List
    # VAR_TEMP:
    #   list_pointer: DInt
    #   ret: Linked List: Node
    Linked_List__Private__Clear_Node(context['ret'])
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['list_pointer'] = _loop_var_1
        if (context['list'].me[int(context['list_pointer'])].meta.next == context['current'].meta.key):
            context['ret'] = context['list'].me[int(context['list_pointer'])]
            break
    context['Linked List: Private: Get Previous'] = context['ret']


def Linked_List__Private__After(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   node: Linked List: Node
    #   previous_node: Linked List: Node
    context['node'].meta.next = context['previous_node'].meta.next
    context['previous_node'].meta.next = context['node'].meta.key
    if context['previous_node'].meta.is_tail:
        context['previous_node'].meta.is_tail = False
        context['node'].meta.is_tail = True


def Linked_List__Private__Head_an_Empty_List(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   data: Linked List: Node: Data
    #   terminal_behavior: String
    # VAR_IN_OUT:
    #   list: Linked List: List
    context['list'].me[int(0)].data = context['data']
    context['list'].me[int(0)].meta.key = 0
    if (context['terminal_behavior'] == 'open'):
        context['list'].me[int(0)].meta.next = context['NULL_TOKEN']
    if (context['terminal_behavior'] == 'closed'):
        context['list'].me[int(0)].meta.next = 0
    context['list'].me[int(0)].meta.is_head = True
    context['list'].me[int(0)].meta.is_tail = True


def Linked_List__Private__Is_Empty(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   list: Linked List: List
    # VAR_TEMP:
    #   pointer_list: DInt
    #   ret: Bool
    context['ret'] = True
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if (context['list'].me[int(context['pointer_list'])].meta.key != context['NULL_TOKEN']):
            context['ret'] = False
            break
    context['Linked List: Private: Is Empty'] = context['ret']


def Linked_List__Private__Get_Tail(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Linked List: Node
    # VAR_IN_OUT:
    #   list: Linked List: List
    # VAR_TEMP:
    #   pointer_list: Int
    #   next_node: UInt
    #   ret: Linked List: Node
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if context['list'].me[int(context['pointer_list'])].meta.is_tail:
            context['ret'] = context['list'].me[int(context['pointer_list'])]
            break
    context['Linked List: Private: Get Tail'] = context['ret']


def Linked_List__Private__Is_Full(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   list: Linked List: List
    # VAR_TEMP:
    #   pointer_list: DInt
    #   ret: Bool
    context['ret'] = True
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if (context['list'].me[int(context['pointer_list'])].meta.key == context['NULL_TOKEN']):
            context['ret'] = False
            break
    context['Linked List: Private: Is Full'] = context['ret']


def Linked_List__Private__Next_Empty_Node(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: DInt
    # VAR_IN_OUT:
    #   list: Linked List: List
    # VAR_TEMP:
    #   node: Linked List: Node
    #   pointer_list: Int
    #   ret: DInt
    context['ret'] = context['NULL_TOKEN']
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if (context['list'].me[int(context['pointer_list'])].meta.key == context['NULL_TOKEN']):
            context['ret'] = INT_TO_DINT(context['pointer_list'])
            break
    context['Linked List: Private: Next Empty Node'] = context['ret']


def Linked_List__Append(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   terminal_behavior: String
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Append
    #   list: Linked List: List
    # VAR_TEMP:
    #   clear_commands: Linked List: Method Interface: Append
    #   head: Linked List: Node
    #   pointer_new_node: DInt
    #   tail: Linked List: Node
    # VAR CONSTANT:
    #   no_error: String
    context['no_error'] = 'no error'
    #   list_full: String
    context['list_full'] = 'appended to full list'
    #   no_tail_found: String
    context['no_tail_found'] = 'no tail found while trying to append'
    #   appended_as_head: String
    context['appended_as_head'] = 'appended as head of list'
    if Linked_List__Private__Is_Full(context['list']):
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['list_full']
        return
    if Linked_List__Private__Is_Empty(context['list']):
        Linked_List__Private__Head_an_Empty_List(data=context['commands']['in'].data, terminal_behavior=context['terminal_behavior'], list=context['list'])
        context['commands'] = context['clear_commands']
        context['commands'].out.done = True
        context['commands'].out.error_message = context['appended_as_head']
        return
    context['tail'] = Linked_List__Private__Get_Tail(context['list'])
    if (context['tail'].meta.key == context['NULL_TOKEN']):
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['no_tail_found']
        return
    context['pointer_new_node'] = Linked_List__Private__Next_Empty_Node(context['list'])
    context['list'].me[int(context['pointer_new_node'])].data = context['commands']['in'].data
    context['list'].me[int(context['pointer_new_node'])].meta.key = context['pointer_new_node']
    Linked_List__Private__After(node=context['list'].me[int(context['pointer_new_node'])], previous_node=context['list'].me[int(context['tail'].meta.key)])
    context['commands'] = context['clear_commands']
    context['commands'].out.done = True
    context['commands'].out.error_message = context['no_error']


def Linked_List__Delete(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Delete
    #   list: Linked List: List
    # VAR_TEMP:
    #   blank_node: Linked List: Node
    #   clear_commands: Linked List: Method Interface: Delete
    #   current: Linked List: Node
    #   found: Bool
    #   next: Linked List: Node
    #   pointer_list: DInt
    #   previous: Linked List: Node
    #   search_commands: Linked List: Method Interface: Search
    # VAR CONSTANT:
    #   no_error: String
    context['no_error'] = 'no error'
    #   delete_from_empty: String
    context['delete_from_empty'] = 'deleted from an empty list.'
    if Linked_List__Private__Is_Empty(context['list']):
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['delete_from_empty']
    context['current'] = context['commands']['in'].node
    context['previous'] = Linked_List__Private__Get_Previous(current=context['current'], list=context['list'])
    context['next'] = Linked_List__Private__Get_Next(current=context['current'], list=context['list'])
    if (context['current'].meta.is_head and (not context['current'].meta.is_tail)):
        Linked_List__Private__Head_Swap(new_head=context['list'].me[int(context['next'].meta.key)], old_head=context['list'].me[int(context['current'].meta.key)])
    if ((not context['current'].meta.is_head) and context['current'].meta.is_tail):
        Linked_List__Private__Tail_Swap(new_tail=context['list'].me[int(context['previous'].meta.key)], old_tail=context['list'].me[int(context['current'].meta.key)])
    if (not context['current'].meta.is_head):
        context['list'].me[int(context['previous'].meta.key)].meta.next = context['next'].meta.key
    Linked_List__Private__Clear_Node(context['list'].me[int(context['current'].meta.key)])
    context['commands'] = context['clear_commands']
    context['commands'].out.done = True
    context['commands'].out.error_message = context['no_error']


def Linked_List__Search(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Search
    #   list: Linked List: List
    # VAR_TEMP:
    #   clear_commands: Linked List: Method Interface: Search
    #   found: Bool
    #   pointer_list: DInt
    # VAR CONSTANT:
    #   no_error: String
    context['no_error'] = 'no error'
    #   searched_empty_list: String
    context['searched_empty_list'] = 'searched empty list'
    if Linked_List__Private__Is_Empty(context['list']):
        context['commands'] = context['clear_commands']
        context['commands'].out.not_found = True
        context['commands'].out.error = True
        context['commands'].out.error_message = context['searched_empty_list']
        return
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['pointer_list'] = _loop_var_1
        if (context['list'].me[int(context['pointer_list'])].data == context['commands']['in'].data):
            context['found'] = True
            break
    if context['found']:
        context['commands'] = context['clear_commands']
        context['commands'].out.done = True
        context['commands'].out.found = True
        context['commands'].out.returned_node = context['list'].me[int(context['pointer_list'])]
        context['commands'].out.error_message = context['no_error']
        return
    if (not context['found']):
        context['commands'] = context['clear_commands']
        context['commands'].out.done = True
        context['commands'].out.not_found = True
        return


def Linked_List__Display(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Display
    #   list: Linked List: List
    # VAR_TEMP:
    #   clear_commands: Linked List: Method Interface: Display
    context['commands'] = context['clear_commands']
    context['commands'].out.list = context['list']
    context['commands'].out.done = True


def Linked_List__Insert(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   terminal_behavior: String
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Insert
    #   list: Linked List: List
    # VAR_TEMP:
    #   clear_commands: Linked List: Method Interface: Insert
    #   current: Linked List: Node
    #   next_empty_node_index: DInt
    #   previous: Linked List: Node
    #   next: Linked List: Node
    # VAR CONSTANT:
    #   no_error: String
    context['no_error'] = 'no error'
    #   inserted_into_full: String
    context['inserted_into_full'] = 'attempted to insert into full list. delete a node and try again.'
    #   appended_as_head: String
    context['appended_as_head'] = 'appended as head of list'
    if Linked_List__Private__Is_Full(context['list']):
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['inserted_into_full']
        return
    if Linked_List__Private__Is_Empty(context['list']):
        Linked_List__Private__Head_an_Empty_List(data=context['commands']['in'].data, terminal_behavior=context['terminal_behavior'], list=context['list'])
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['appended_as_head']
        return
    context['next_empty_node_index'] = Linked_List__Private__Next_Empty_Node(context['list'])
    context['current'] = context['commands']['in'].target_node
    context['previous'] = Linked_List__Private__Get_Previous(current=context['current'], list=context['list'])
    context['next'] = context['current']
    context['list'].me[int(context['next_empty_node_index'])].data = context['commands']['in'].data
    context['list'].me[int(context['next_empty_node_index'])].meta.key = context['next_empty_node_index']
    context['current'] = context['list'].me[int(context['next_empty_node_index'])]
    if (not context['next'].meta.is_head):
        Linked_List__Private__After(node=context['list'].me[int(context['current'].meta.key)], previous_node=context['list'].me[int(context['previous'].meta.key)])
    Linked_List__Private__Before(next_node=context['list'].me[int(context['next'].meta.key)], node=context['list'].me[int(context['current'].meta.key)])
    context['commands'] = context['clear_commands']
    context['commands'].out.done = True
    context['commands'].out.error_message = context['no_error']


def Linked_List__Reverse(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Reverse
    #   list: Linked List: List
    # VAR_TEMP:
    #   clear_commands: Linked List: Method Interface: Reverse
    #   current: Linked List: Node
    #   next: Linked List: Node
    #   previous: Linked List: Node
    #   null_node: Linked List: Node
    # VAR CONSTANT:
    #   no_error: String
    context['no_error'] = 'no error'
    #   reversed_empty_list: String
    context['reversed_empty_list'] = 'reversed empty list'
    if Linked_List__Private__Is_Empty(context['list']):
        context['commands'] = context['clear_commands']
        context['commands'].out.error = True
        context['commands'].out.error_message = context['reversed_empty_list']
        return
    Linked_List__Private__Clear_Node(context['null_node'])
    context['previous'] = context['null_node']
    context['current'] = Linked_List__Private__Get_Head(context['list'])
    context['list'].me[int(context['current'].meta.key)].meta.is_head = False
    context['list'].me[int(context['current'].meta.key)].meta.is_tail = True
    while (context['current'].meta.next != context['NULL_TOKEN']):
        context['next'] = context['list'].me[int(context['current'].meta.next)]
        context['list'].me[int(context['current'].meta.key)].meta.next = context['previous'].meta.key
        context['previous'] = context['current']
        context['current'] = context['next']
        context['list'].me[int(context['current'].meta.key)].meta.is_head = False
        context['list'].me[int(context['current'].meta.key)].meta.is_tail = False
    context['list'].me[int(context['current'].meta.key)].meta.next = context['previous'].meta.key
    context['list'].me[int(context['current'].meta.key)].meta.is_head = True
    context['list'].me[int(context['current'].meta.key)].meta.is_tail = False
    context['commands'] = context['clear_commands']
    context['commands'].out.done = True
    context['commands'].out.error_message = context['no_error']


def Linked_List__Reset(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   commands: Linked List: Method Interface: Reset
    #   list: Linked List: List
    # VAR_TEMP:
    #   blank_node: Linked List: Node
    #   list_pointer: DInt
    #   clear_commands: Linked List: Method Interface: Reset
    for _loop_var_1 in range(int(0), int(context['LINKED_LIST_LENGTH']) + 1):
        context['list_pointer'] = _loop_var_1
        Linked_List__Private__Clear_Node(context['list'].me[int(context['list_pointer'])])
    context['commands'] = context['clear_commands']
    context['commands'].out.done = True


def Linked_List(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   interface: Linked List: Method Interface
    # VAR:
    #   list: Linked List: List
    # VAR CONSTANT:
    #   TERMINAL_BEHAVIOR: String
    context['TERMINAL_BEHAVIOR'] = 'open'
    if context['interface'].append['in'].request:
        Linked_List__Append(terminal_behavior=context['TERMINAL_BEHAVIOR'], commands=context['interface'].append, list=context['list'])
    if context['interface'].delete['in'].request:
        Linked_List__Delete(commands=context['interface'].delete, list=context['list'])
    if context['interface'].display['in'].request:
        Linked_List__Display(commands=context['interface'].display, list=context['list'])
    if context['interface'].insert['in'].request:
        Linked_List__Insert(terminal_behavior=context['TERMINAL_BEHAVIOR'], commands=context['interface'].insert, list=context['list'])
    if context['interface'].reset['in'].request:
        Linked_List__Reset(commands=context['interface'].reset, list=context['list'])
    if context['interface'].reverse['in'].request:
        Linked_List__Reverse(commands=context['interface'].reverse, list=context['list'])
    if context['interface'].search['in'].request:
        Linked_List__Search(commands=context['interface'].search, list=context['list'])
