//problem -10
#include <iostream>
using namespace std;
int main()
{
   int  a[5] , b[5],i ,add=0;
    cout<<"Enter the first array elements ="<< endl;
    for(i=0;i<5;i++)
    {
        cout <<"NUM 1 ["<<i<<"] =";
        cin>> a[i];
    }

     cout<<"Enter the second array elements ="<<endl;
        for(i=0;i<5;i++)
    {
        cout <<"NUM 2 ["<<i<<"]=";
        cin>> b[i];
    }
    cout<<"The first array elements are ="<<endl;
         for(i=0;i<5;i++)
    {
        cout <<a[i]<<"\t";
    }
    cout<<endl<<"The second array elements are ="<<endl;
         for(i=0;i<5;i++)
    {
        cout <<b[i]<<"\t";
    }
     cout<<endl<<endl<<"**After adding  2 Array **  = "<<endl;
     for(i=0;i<5;i++)
    {
        add= a[i] +b[i];
         cout<<add<<"\t";
    }


}
