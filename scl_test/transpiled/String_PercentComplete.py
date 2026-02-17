import math

def String_PercentComplete(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   percent_complete: Int
    context['String.PercentComplete'] = CONCAT_STRING(IN1=INT_TO_STRING(context['percent_complete']), IN2='% complete')
    return
