// find the largest value of an array using bubble sort Algorithm.
#include<stdio.h>
void main ()
{  int  n,i,j,num1[50], temp=0;
    printf("How many numbers you want to input = ");
    scanf("%d",&n);
    printf("Enter  %d  numbers  =\n",n);
    for(i=0; i<n; i++)
    {
        printf("num[%d] =",i);
        scanf("%d",&num1[i]);
    }
    printf("--------All the value before accending  = \n");
    for(i=0; i<n; i++)
    {
        printf("%d\t",num1[i]);
    }
    for(i=0; i<n; i++)   // accending case
    {
        for(j=i+1 ; j<n ; j++)
        {
            if(num1[i]> num1[j])
            {
                temp= num1[i];
                num1[i]= num1[j];
                num1[j] = temp;
            }
        }
    }
    printf("\n--------All the value after accending  = \n");

    for(i=0; i<n; i++)
    {
        printf("%d\t",num1[i]);
    }
printf("\n\n-------The largest number of this value = %d-------",num1[i-1] );
printf("\n\n-------The smallest number of this value = %d-------",num1[0] );
}
